import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Check, X, CalendarClock, MapPin } from 'lucide-react';
import { useManagerStore } from '@/store/managerStore';
import { callLLM, isLLMError, type ClarifyData } from '@/services/manager/managerLlm';
import { managerAi } from '@/services/manager/managerAi';
import { findFreeSlots } from '@/services/manager/schedulingEngine';
import { scheduleTaskReminder } from '@/services/manager/notifications';
import type { AIIntent } from '@/types/manager';
import {
  getTodayJalali,
  formatJalali,
  getTodayISO,
  toFaDigits,
  parseJalali,
  toGregorian,
  gregorianToISO,
  addJalaliDays,
  getStartOfWeek,
  getEndOfWeek,
} from '@/utils/jalaliDate';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  intentData?: Record<string, unknown> | null;
  actions?: { label: string; type: 'confirm' | 'cancel' }[];
  clarify?: ClarifyData | null;
}

let messageCounter = 0;
const nextId = () => `msg-${messageCounter++}`;

function intentDateToISO(dateStr: string): string | null {
  const parsed = parseJalali(dateStr);
  if (!parsed) {
    return /^\d{4}-\d{2}-\d{2}/.test(dateStr) ? dateStr.slice(0, 10) : null;
  }
  return gregorianToISO(toGregorian(parsed.year, parsed.month, parsed.day));
}

function buildGreeting(holidays: { title: string; gregorianDate: string; isOfficialHoliday: boolean }[]): string {
  const today = getTodayJalali();
  const weekday = formatJalali(today, 'full').split(' ')[0];
  let greeting = `سلام! من دستیار مدیریت تو هستم. امروز ${weekday} ${toFaDigits(today.day)} ماه است.`;
  const todayHolidays = holidays.filter((h) => h.gregorianDate === getTodayISO());
  if (todayHolidays.length > 0) {
    greeting += `\n\nامروز ${todayHolidays.map((h) => h.title).join('، ')} است.`;
    if (todayHolidays.some((h) => h.isOfficialHoliday)) {
      greeting += ' روز تعطیل رسمیه، پس می‌تونی استراحت کنی!';
    }
  }
  greeting += '\n\nبرنامه‌ات رو با هم مدیریت کنیم. هر چیزی که تو ذهنته بگو — مثلاً «فردا ساعت ۱۰ جلسه دارم» یا «برنامه امروزم چیه؟»';
  return greeting;
}

export function AssistantTab() {
  const tasks = useManagerStore((s) => s.tasks);
  const events = useManagerStore((s) => s.events);
  const holidays = useManagerStore((s) => s.holidays);
  const preferences = useManagerStore((s) => s.preferences);
  const addTask = useManagerStore((s) => s.addTask);
  const addEvent = useManagerStore((s) => s.addEvent);
  const toggleTask = useManagerStore((s) => s.toggleTask);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '0', role: 'assistant', content: buildGreeting(holidays) },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const pushMessage = useCallback((m: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: nextId() }]);
  }, []);

  const clearActions = useCallback(() => {
    setMessages((prev) => prev.map((m) => (m.actions?.length ? { ...m, actions: [] } : m)));
  }, []);

  /** Executes a confirmed intent (from LLM or local parser) */
  const handleConfirm = useCallback(
    async (intentData: Record<string, unknown>) => {
      const action = intentData.action as string;

      if (action === 'create_task' || action === 'create_recurring_task') {
        const title = (intentData.title as string) || 'کار';
        const dateStr = (intentData.date as string) || formatJalali(getTodayJalali(), 'short');
        const iso = intentDateToISO(dateStr);
        if (!iso) {
          pushMessage({ role: 'assistant', content: 'تاریخ رو نتونستم بفهمم. لطفاً دوباره بگو.' });
          return;
        }
        const task = addTask({
          title,
          dueDate: iso,
          dueTime: (intentData.time as string) || undefined,
          priority: 'medium',
          category: 'personal',
          status: 'pending',
          recurrence: (intentData.recurrence as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'none',
        });
        if (task && task.dueTime) {
          await scheduleTaskReminder(task.title, task.dueDate, task.dueTime, preferences?.defaultReminder ?? 15);
        }
        pushMessage({
          role: 'assistant',
          content: `✓ کار «${title}» برای ${formatJalali(parseJalali(dateStr) ?? getTodayJalali(), 'long')}${
            intentData.time ? ` ساعت ${toFaDigits(intentData.time as string)}` : ''
          } ثبت شد.${task.dueTime ? ` ${toFaDigits(preferences?.defaultReminder ?? 15)} دقیقه قبل یادآوری می‌کنم.` : ''}`,
        });
        return;
      }

      if (action === 'create_event') {
        const title = (intentData.title as string) || 'رویداد';
        const dateStr = (intentData.date as string) || formatJalali(getTodayJalali(), 'short');
        const iso = intentDateToISO(dateStr);
        if (!iso) {
          pushMessage({ role: 'assistant', content: 'تاریخ رو نتونستم بفهمم. لطفاً دوباره بگو.' });
          return;
        }
        const time = (intentData.time as string) || '10:00';
        const event = addEvent({ title, date: iso, startTime: time, color: '#3157D5', category: 'work' });
        if (event) {
          await scheduleTaskReminder(event.title, event.date, event.startTime, preferences?.defaultReminder ?? 15);
        }
        pushMessage({
          role: 'assistant',
          content: `✓ رویداد «${title}» برای ${formatJalali(parseJalali(dateStr) ?? getTodayJalali(), 'long')} ساعت ${toFaDigits(time)} ثبت شد.`,
        });
        return;
      }

      pushMessage({ role: 'assistant', content: 'این عملیات هنوز پشتیبانی نمی‌شود.' });
    },
    [addTask, addEvent, preferences, pushMessage],
  );


  /** Handles intents that don't need confirmation (summaries, free time…) */
  const handleInfoIntent = useCallback(
    (intent: AIIntent): string | null => {
      switch (intent.action) {
        case 'find_free_time': {
          const duration = (intent.duration as number) || 120;
          const result = findFreeSlots({
            events,
            tasks,
            holidays,
            workStart: preferences?.workStart ?? '08:00',
            workEnd: preferences?.workEnd ?? '20:00',
            workDays: preferences?.workDays ?? [0, 1, 2, 3, 4],
            durationMinutes: duration,
          });
          return managerAi.generateScheduleSuggestion(result.slots, 'کار پیشنهادی');
        }
        case 'show_today': {
          const todayISO = getTodayISO();
          const dayTasks = tasks.filter((t) => t.dueDate === todayISO && t.status === 'pending');
          const dayEvents = events.filter((e) => e.date === todayISO);
          let text = `برنامه امروز (${formatJalali(getTodayJalali(), 'long')}):\n\n`;
          if (dayEvents.length === 0 && dayTasks.length === 0) {
            text += 'امروز برنامه‌ای نداری. روزت خالیه! 🎉';
          } else {
            for (const e of dayEvents) text += `• رویداد: ${e.title} — ساعت ${toFaDigits(e.startTime)}\n`;
            for (const t of dayTasks)
              text += `• کار: ${t.title}${t.dueTime ? ` — ساعت ${toFaDigits(t.dueTime)}` : ''}\n`;
          }
          return text.trim();
        }
        case 'summarize_week': {
          const start = getStartOfWeek(getTodayJalali());
          const end = getEndOfWeek(getTodayJalali());
          const startISO = gregorianToISO(toGregorian(start.year, start.month, start.day));
          const endISO = gregorianToISO(toGregorian(end.year, end.month, end.day));
          const weekTasks = tasks.filter((t) => t.dueDate >= startISO && t.dueDate <= endISO);
          const completed = weekTasks.filter((t) => t.status === 'completed').length;
          const pending = weekTasks.filter((t) => t.status === 'pending').length;
          return managerAi.generateWeeklyInsight(completed, pending);
        }
        case 'show_upcoming': {
          const today = getTodayJalali();
          let text = 'کارهای پیش‌رو:\n\n';
          const upcoming = tasks
            .filter((t) => {
              const iso = gregorianToISO(toGregorian(today.year, today.month, today.day));
              return t.dueDate >= iso && t.status === 'pending';
            })
            .slice(0, 8);
          if (upcoming.length === 0) return 'کار پیش‌رویی نداری.';
          for (const t of upcoming) {
            const d = parseJalali(t.dueDate.replace(/-/g, '/'));
            text += `• ${t.title} — ${d ? formatJalali(d, 'long') : t.dueDate}\n`;
          }
          return text.trim();
        }
        case 'complete_task': {
          const todayISO = getTodayISO();
          const target = tasks.find(
            (t) => t.status === 'pending' && (t.dueDate === todayISO || t.dueDate < todayISO),
          );
          if (!target) return 'کار در جریانی برای علامت‌زدن پیدا نکردم.';
          toggleTask(target.id);
          return `✓ «${target.title}» به‌عنوان انجام‌شده علامت خورد.`;
        }
        default:
          return null;
      }
    },
    [events, tasks, holidays, preferences, toggleTask],
  );

  /** Offline/rule-based fallback — always available */
  const processWithLocalParser = useCallback(
    (text: string): Omit<ChatMessage, 'id'> => {
      const result = managerAi.parseUserIntent(text);
      const intent = result.intent;

      if (!result.needsConfirmation) {
        const info = handleInfoIntent(intent);
        if (info) return { role: 'assistant', content: info };
      }

      return {
        role: 'assistant',
        content: result.confirmationMessage ?? 'متوجه نشدم. لطفاً واضح‌تر بگو.',
        intentData: result.needsConfirmation ? intent : null,
        actions: result.needsConfirmation
          ? [
              { label: 'ثبت کن', type: 'confirm' as const },
              { label: 'انصراف', type: 'cancel' as const },
            ]
          : [],
      };
    },
    [handleInfoIntent],
  );


  const processUserInput = useCallback(
    async (text: string) => {
      setThinking(true);

      // Plain-text confirm/cancel against the last action message
      const isConfirmText = /^(بله|آره|ثبت کن|تأیید|باشه|درسته|انجام بده)\s*[!؟.]?$/i.test(text.trim());
      const isCancelText = /^(نه|لغو|بی‌خیال|کنسل|انصراف|نمی‌خوام)\s*[!؟.]?$/i.test(text.trim());
      if (isConfirmText || isCancelText) {
        const lastActionMsg = [...messages]
          .reverse()
          .find((m) => m.role === 'assistant' && m.actions && m.actions.length > 0 && m.intentData);
        if (lastActionMsg && lastActionMsg.intentData) {
          clearActions();
          setThinking(false);
          if (isConfirmText) await handleConfirm(lastActionMsg.intentData);
          return;
        }
      }

      const contextMessages = [
        ...messages
          .filter((m) => !m.actions || m.actions.length === 0)
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: text },
      ];

      const llmResponse = await callLLM(contextMessages, tasks, events, holidays);

      if (!llmResponse) {
        setThinking(false);
        pushMessage(processWithLocalParser(text));
        return;
      }

      if (isLLMError(llmResponse)) {
        setThinking(false);
        const fallback = processWithLocalParser(text);
        pushMessage({
          role: 'assistant',
          content: `${llmResponse.error}\n\nدر عین حال، از پردازش محلی استفاده می‌کنم.\n\n${fallback.content}`,
          intentData: fallback.intentData,
          actions: fallback.actions,
        });
        return;
      }

      const intent = llmResponse.intent as AIIntent | null;

      // Clarify flow — ask the user for the missing detail
      if (llmResponse.clarify && llmResponse.clarify.partialIntent) {
        setThinking(false);
        pushMessage({
          role: 'assistant',
          content: llmResponse.reply,
          clarify: llmResponse.clarify,
          intentData: llmResponse.clarify.partialIntent,
        });
        return;
      }

      if (llmResponse.needsConfirmation && intent) {
        setThinking(false);
        pushMessage({
          role: 'assistant',
          content: llmResponse.reply,
          intentData: intent,
          actions: [
            { label: 'ثبت کن', type: 'confirm' },
            { label: 'انصراف', type: 'cancel' },
          ],
        });
        return;
      }

      if (intent && ['find_free_time', 'show_today', 'summarize_week', 'show_upcoming', 'complete_task'].includes(intent.action)) {
        const info = handleInfoIntent(intent);
        setThinking(false);
        pushMessage({ role: 'assistant', content: info ?? llmResponse.reply });
        return;
      }

      setThinking(false);
      pushMessage({ role: 'assistant', content: llmResponse.reply });
    },
    [messages, tasks, events, holidays, handleConfirm, handleInfoIntent, processWithLocalParser, clearActions, pushMessage],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || thinking) return;
    pushMessage({ role: 'user', content: text });
    setInput('');
    void processUserInput(text);
  }, [input, thinking, pushMessage, processUserInput]);

  const handleActionClick = useCallback(
    async (action: 'confirm' | 'cancel', msg: ChatMessage) => {
      clearActions();
      if (action === 'confirm' && msg.intentData) {
        await handleConfirm(msg.intentData);
      } else {
        pushMessage({ role: 'assistant', content: 'باشه، انصراف دادم.' });
      }
    },
    [clearActions, handleConfirm, pushMessage],
  );


  const quickPrompts = ['برنامه امروزم چیه؟', 'فردا ساعت ۱۰ جلسه دارم', 'این هفته چند کار انجام دادم؟'];

  return (
    <div className="flex h-[calc(100vh-14rem)] flex-col lg:h-[calc(100vh-12rem)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">دستیار مدیریت</h2>
          <p className="text-[11px] text-slate-400">کار، رویداد و برنامه‌ریزی با جمله ساده</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-1 py-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                m.role === 'user'
                  ? 'rounded-bl-md bg-indigo-600 text-white'
                  : 'glass rounded-br-md text-slate-700'
              }`}
            >
              <p className="whitespace-pre-line text-right">{m.content}</p>

              {m.clarify && m.clarify.quickReplies.length > 0 && (
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  {m.clarify.quickReplies.map((qr) => (
                    <button
                      key={qr}
                      onClick={() => {
                        pushMessage({ role: 'user', content: qr });
                        void processUserInput(qr);
                      }}
                      className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-100"
                    >
                      {qr}
                    </button>
                  ))}
                </div>
              )}

              {m.actions && m.actions.length > 0 && (
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => void handleActionClick('confirm', m)}
                    className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {m.actions.find((a) => a.type === 'confirm')?.label ?? 'تایید'}
                  </button>
                  <button
                    onClick={() => void handleActionClick('cancel', m)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    {m.actions.find((a) => a.type === 'cancel')?.label ?? 'لغو'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-end">
            <div className="glass flex items-center gap-2 rounded-2xl rounded-br-md px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:0.3s]" />
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts (only at start) */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap justify-end gap-2 pb-2">
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => {
                pushMessage({ role: 'user', content: q });
                void processUserInput(q);
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="glass flex items-center gap-2 rounded-2xl p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="بنویس... مثلاً «پنجشنبه ساعت ۱۵ آزمایش دارم»"
          className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || thinking}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
          aria-label="ارسال"
        >
          <Send className="h-4 w-4 -scale-x-100" />
        </button>
      </div>

      <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-slate-400">
        <MapPin className="h-3 w-3" />
        داده‌ها روی دستگاه خودتان ذخیره می‌شوند
        <CalendarClock className="h-3 w-3" />
      </p>
    </div>
  );
}

