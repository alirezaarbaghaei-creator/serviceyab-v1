/**
 * Reminder notifications for the Life Manager — web port of
 * life_manager's expo-notifications service.
 *
 * Uses the Notification API + in-process timers (works in browsers and in
 * Capacitor WebViews while the app is open). Reminders for future tasks are
 * re-scheduled on app start via rescheduleAll().
 */
const timers = new Map<string, number>();

function notificationsAvailable(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!notificationsAvailable()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch (e) {
    console.warn('requestNotificationPermissions error', e);
    return false;
  }
}

function showNotification(title: string, body: string): void {
  if (!notificationsAvailable() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon.png' });
  } catch (e) {
    console.warn('showNotification error', e);
  }
}

export function cancelReminder(notificationId: string): void {
  const t = timers.get(notificationId);
  if (t !== undefined) {
    window.clearTimeout(t);
    timers.delete(notificationId);
  }
}

export function cancelAllReminders(): void {
  for (const t of timers.values()) window.clearTimeout(t);
  timers.clear();
}

/**
 * Schedule a local reminder. Returns an id (or null when the trigger is in
 * the past / notifications unavailable).
 */
export async function scheduleReminder(
  title: string,
  body: string,
  triggerDate: string,
  triggerTime: string,
): Promise<string | null> {
  if (!notificationsAvailable()) return null;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  const [year, month, day] = triggerDate.split('-').map(Number);
  const [hour, minute] = triggerTime.split(':').map(Number);
  const trigger = new Date(year, month - 1, day, hour, minute, 0);

  if (trigger.getTime() <= Date.now()) return null;

  const id = `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const delay = trigger.getTime() - Date.now();
  // setTimeout max is ~24.8 days — anything beyond that fires at start-up instead
  const MAX_DELAY = 2_147_483_647;
  const handle = window.setTimeout(
    () => {
      timers.delete(id);
      showNotification(title, body);
    },
    Math.min(delay, MAX_DELAY),
  );
  timers.set(id, handle);
  return id;
}

export async function scheduleTaskReminder(
  taskTitle: string,
  dueDate: string,
  dueTime: string,
  minutesBefore = 15,
): Promise<string | null> {
  if (!dueDate || !dueTime) return null;

  const [year, month, day] = dueDate.split('-').map(Number);
  const [hour, minute] = dueTime.split(':').map(Number);
  const taskTime = new Date(year, month - 1, day, hour, minute, 0);
  taskTime.setMinutes(taskTime.getMinutes() - minutesBefore);

  if (taskTime.getTime() <= Date.now()) return null;

  const triggerDate = `${taskTime.getFullYear()}-${String(taskTime.getMonth() + 1).padStart(2, '0')}-${String(taskTime.getDate()).padStart(2, '0')}`;
  const triggerTime = `${String(taskTime.getHours()).padStart(2, '0')}:${String(taskTime.getMinutes()).padStart(2, '0')}`;

  const body =
    minutesBefore > 0
      ? `${minutesBefore} دقیقه تا «${taskTitle}» باقی مانده.`
      : `وقت «${taskTitle}» رسید.`;

  return scheduleReminder('یادآوری مدیر من', body, triggerDate, triggerTime);
}

export const scheduleEventReminder = scheduleTaskReminder;
