/**
 * Life Manager store — Zustand port of life_manager's dataContext.
 * Local-first data with optional cloud sync; drives the «برنامه‌ریز» page.
 */
import { create } from 'zustand';
import type { Task, CalendarEvent, Holiday, UserPreferences } from '@/types/manager';
import { managerDb, pullFromCloud } from '@/services/manager/managerDb';
import { getTodayISO } from '@/utils/jalaliDate';

interface ManagerState {
  loaded: boolean;
  loading: boolean;
  tasks: Task[];
  events: CalendarEvent[];
  holidays: Holiday[];
  preferences: UserPreferences | null;

  refresh: () => Promise<void>;
  addTask: (task: Partial<Task>) => Task | null;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTask: (id: string) => void;
  skipTask: (id: string) => void;

  addEvent: (event: Partial<CalendarEvent>) => CalendarEvent | null;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;

  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

export const useManagerStore = create<ManagerState>((set, get) => ({
  loaded: false,
  loading: false,
  tasks: managerDb.loadTasks(),
  events: managerDb.loadEvents(),
  holidays: managerDb.loadHolidays(),
  preferences: null,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const preferences = managerDb.loadPreferences('local');

      // Best-effort cloud pull (no-op without a Supabase session)
      const cloud = await pullFromCloud();

      // Holidays: local first, then upgrade from cloud reference table
      const holidays = (await managerDb.refreshHolidaysFromCloud()) ?? [];

      set({
        tasks: cloud?.tasks ?? managerDb.loadTasks(),
        events: cloud?.events ?? managerDb.loadEvents(),
        holidays: holidays.length > 0 ? holidays : (cloud?.holidays ?? []),
        preferences,
        loaded: true,
        loading: false,
      });
    } catch (err) {
      console.warn('manager refresh error', err);
      set({
        tasks: managerDb.loadTasks(),
        events: managerDb.loadEvents(),
        holidays: managerDb.loadHolidays(),
        preferences: managerDb.loadPreferences('local'),
        loaded: true,
        loading: false,
      });
    }
  },

  addTask: (input) => {
    const task = managerDb.createTask({
      ...input,
      userId: get().preferences?.userId ?? 'local',
    });
    const tasks = [...get().tasks, task].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    managerDb.saveTasks(tasks);
    set({ tasks });
    return task;
  },

  updateTask: (id, updates) => {
    const updated = managerDb.updateTask(id, updates, get().tasks);
    if (!updated) return;
    const tasks = get().tasks.map((t) => (t.id === id ? updated : t));
    managerDb.saveTasks(tasks);
    set({ tasks });
  },

  deleteTask: (id) => {
    managerDb.deleteTask(id);
    const tasks = get().tasks.filter((t) => t.id !== id);
    managerDb.saveTasks(tasks);
    set({ tasks });
  },

  toggleTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    const completed = task.status === 'completed';
    get().updateTask(id, {
      status: completed ? 'pending' : 'completed',
      completedAt: completed ? undefined : new Date().toISOString(),
    });
  },

  skipTask: (id) => {
    get().updateTask(id, { status: 'skipped' });
  },

  addEvent: (input) => {
    const event = managerDb.createEvent({
      ...input,
      userId: get().preferences?.userId ?? 'local',
    });
    const events = [...get().events, event].sort((a, b) => a.date.localeCompare(b.date));
    managerDb.saveEvents(events);
    set({ events });
    return event;
  },

  updateEvent: (id, updates) => {
    const updated = managerDb.updateEvent(id, updates, get().events);
    if (!updated) return;
    const events = get().events.map((e) => (e.id === id ? updated : e));
    managerDb.saveEvents(events);
    set({ events });
  },

  deleteEvent: (id) => {
    managerDb.deleteEvent(id);
    const events = get().events.filter((e) => e.id !== id);
    managerDb.saveEvents(events);
    set({ events });
  },

  updatePreferences: (prefs) => {
    const current = get().preferences ?? managerDb.loadPreferences('local');
    const next = { ...current, ...prefs };
    managerDb.savePreferences(next);
    set({ preferences: next });
  },
}));

/** Convenience selectors used by the tabs */
export const selectTodayPendingTasks = (s: ManagerState): Task[] => {
  const today = getTodayISO();
  return s.tasks.filter((t) => t.dueDate === today && t.status === 'pending');
};
