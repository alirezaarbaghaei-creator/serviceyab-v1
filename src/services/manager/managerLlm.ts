/**
 * LLM bridge for the Life Manager assistant — calls the `ai-chat` Supabase
 * Edge Function (shipped under supabase/functions/ai-chat) with rich Jalali
 * context. Returns null when unavailable so callers fall back to the
 * rule-based parser in managerAi.ts.
 */
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Task, CalendarEvent, Holiday, MJalaliDate } from '@/types/manager';
import {
  getTodayJalali,
  formatJalali,
  getJalaliWeekdayName,
  toGregorian,
  addJalaliDays,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  gregorianToISO,
} from '@/utils/jalaliDate';

function dateToISO(date: MJalaliDate): string {
  return gregorianToISO(toGregorian(date.year, date.month, date.day));
}

export interface ClarifyData {
  quickReplies: string[];
  needsDatePicker: boolean;
  needsTimePicker: boolean;
  needsReminderPicker: boolean;
  needsPriorityPicker: boolean;
  partialIntent: Record<string, unknown> | null;
}

export interface LLMResponse {
  reply: string;
  intent: Record<string, unknown> | null;
  needsConfirmation: boolean;
  clarify: ClarifyData | null;
}

export interface LLMError {
  error: string;
  notConfigured: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function isLLMError(resp: LLMResponse | LLMError | null): resp is LLMError {
  return resp !== null && 'error' in resp && !('reply' in resp);
}

export async function callLLM(
  messages: ChatMessage[],
  tasks: Task[],
  events: CalendarEvent[],
  holidays: Holiday[],
): Promise<LLMResponse | LLMError | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  // Edge functions require a session — without one, degrade gracefully.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;
  } catch {
    return null;
  }

  const today = getTodayJalali();
  const tomorrow = addJalaliDays(today, 1);
  const dayAfter = addJalaliDays(today, 2);
  const todayISO = dateToISO(today);
  const tomorrowISO = dateToISO(tomorrow);
  const dayAfterISO = dateToISO(dayAfter);

  const weekStart = getStartOfWeek(today);
  const weekEnd = getEndOfWeek(today);
  const nextWeekStart = addJalaliDays(weekStart, 7);
  const nextWeekEnd = addJalaliDays(weekEnd, 7);
  const monthStart = getStartOfMonth(today);
  const monthEnd = getEndOfMonth(today);

  const weekStartISO = dateToISO(weekStart);
  const weekEndISO = dateToISO(weekEnd);
  const nextWeekStartISO = dateToISO(nextWeekStart);
  const nextWeekEndISO = dateToISO(nextWeekEnd);
  const monthStartISO = dateToISO(monthStart);
  const monthEndISO = dateToISO(monthEnd);

  const mapTask = (t: Task) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    priority: t.priority,
  });
  const mapEvent = (e: CalendarEvent) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    location: e.location,
  });

  const range = (from: string, to: string) => ({
    tasks: tasks.filter((t) => t.dueDate >= from && t.dueDate <= to).map(mapTask),
    events: events.filter((e) => e.date >= from && e.date <= to).map(mapEvent),
  });

  const thisWeek = range(weekStartISO, weekEndISO);
  const nextWeek = range(nextWeekStartISO, nextWeekEndISO);
  const thisMonth = range(monthStartISO, monthEndISO);

  const weekDatesList = Array.from({ length: 7 }, (_, i) => {
    const d = addJalaliDays(weekStart, i);
    const iso = dateToISO(d);
    return {
      jalali: formatJalali(d, 'long'),
      weekday: getJalaliWeekdayName(d),
      iso,
      taskCount: tasks.filter((t) => t.dueDate === iso && t.status === 'pending').length,
      eventCount: events.filter((e) => e.date === iso).length,
    };
  });


  const context = {
    todayJalali: formatJalali(today, 'full'),
    todayWeekday: getJalaliWeekdayName(today),
    todayISO,
    tomorrowJalali: formatJalali(tomorrow, 'long'),
    tomorrowISO,
    dayAfterJalali: formatJalali(dayAfter, 'long'),
    dayAfterISO,
    weekStart: formatJalali(weekStart, 'long'),
    weekEnd: formatJalali(weekEnd, 'long'),
    nextWeekStart: formatJalali(nextWeekStart, 'long'),
    nextWeekEnd: formatJalali(nextWeekEnd, 'long'),
    monthStart: formatJalali(monthStart, 'long'),
    monthEnd: formatJalali(monthEnd, 'long'),
    weekDates: weekDatesList,
    todayHolidays: holidays
      .filter((h) => h.gregorianDate === todayISO)
      .map((h) => ({ title: h.title, isOfficialHoliday: h.isOfficialHoliday, description: h.description })),
    tomorrowHolidays: holidays
      .filter((h) => h.gregorianDate === tomorrowISO)
      .map((h) => ({ title: h.title, isOfficialHoliday: h.isOfficialHoliday })),
    todayTasks: tasks.filter((t) => t.dueDate === todayISO && t.status === 'pending').map(mapTask),
    todayEvents: events.filter((e) => e.date === todayISO).map(mapEvent),
    tomorrowTasks: tasks.filter((t) => t.dueDate === tomorrowISO && t.status === 'pending').map(mapTask),
    tomorrowEvents: events.filter((e) => e.date === tomorrowISO).map(mapEvent),
    dayAfterTasks: tasks.filter((t) => t.dueDate === dayAfterISO && t.status === 'pending').map(mapTask),
    dayAfterEvents: events.filter((e) => e.date === dayAfterISO).map(mapEvent),
    thisWeekTasks: thisWeek.tasks,
    thisWeekEvents: thisWeek.events,
    nextWeekTasks: nextWeek.tasks,
    nextWeekEvents: nextWeek.events,
    thisMonthTasks: thisMonth.tasks,
    thisMonthEvents: thisMonth.events,
    pendingTasks: tasks
      .filter((t) => t.status === 'pending')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 30)
      .map(mapTask),
    upcomingEvents: events
      .filter((e) => e.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 30)
      .map(mapEvent),
    overdueTasks: tasks
      .filter((t) => t.status === 'pending' && t.dueDate < todayISO)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, dueTime: t.dueTime })),
  };

  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { messages, context },
    });

    if (error) {
      console.warn('LLM edge function error:', error.message);
      return null;
    }
    if (!data) return null;

    if (data.error && !data.reply) {
      const notConfigured = data.error.includes('پیکربندی نشده') || data.error.includes('غیرفعال');
      const isApiError = data.error.includes('سرویس هوش مصنوعی');
      return { error: data.error as string, notConfigured: notConfigured && !isApiError };
    }

    if (!data.reply) return null;

    return {
      reply: data.reply as string,
      intent: data.intent ?? null,
      needsConfirmation: data.needsConfirmation ?? false,
      clarify: data.clarify ?? null,
    };
  } catch (err) {
    console.warn('callLLM error:', err);
    return null;
  }
}

