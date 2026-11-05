import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  Key,
  Clock,
  Sparkles,
  Check,
  X,
  Eye,
  EyeOff,
  Cpu,
  Globe,
} from 'lucide-react';
import { useManagerStore } from '@/store/managerStore';
import { useAuthStore } from '@/store/authStore';
import {
  getAISettings,
  saveAISettings,
  testAISettings,
} from '@/services/manager/managerAiSettings';
import { requestNotificationPermissions } from '@/services/manager/notifications';
import { managerAi } from '@/services/manager/managerAi';
import { toFaDigits, getStartOfWeek, getEndOfWeek, getTodayJalali, gregorianToISO, toGregorian } from '@/utils/jalaliDate';
import type { AISettings } from '@/types/manager';

export function MoreTab() {
  const tasks = useManagerStore((s) => s.tasks);
  const preferences = useManagerStore((s) => s.preferences);
  const updatePreferences = useManagerStore((s) => s.updatePreferences);
  const user = useAuthStore((s) => s.user);

  const [showAi, setShowAi] = useState(false);
  const [aiConfig, setAiConfig] = useState<AISettings | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('https://api.gapgpt.app/v1');
  const [modelInput, setModelInput] = useState('gpt-4o-mini');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!showAi) return;
    void (async () => {
      const settings = await getAISettings();
      setAiConfig(settings);
      setApiKeyInput(settings?.apiKey ?? '');
      setBaseUrlInput(settings?.baseUrl ?? 'https://api.gapgpt.app/v1');
      setModelInput(settings?.model ?? 'gpt-4o-mini');
      setAiEnabled(settings?.enabled ?? true);
    })();
  }, [showAi]);

  const handleSaveAi = async () => {
    if (!apiKeyInput.trim()) return;
    setAiBusy(true);
    setAiTestResult(null);
    const saved = await saveAISettings({
      apiKey: apiKeyInput.trim(),
      baseUrl: baseUrlInput.trim() || 'https://api.gapgpt.app/v1',
      model: modelInput.trim() || 'gpt-4o-mini',
      enabled: aiEnabled,
    });
    setAiBusy(false);
    setAiConfig(saved);
    setAiTestResult(
      saved ? { success: true, message: 'ذخیره شد' } : { success: false, message: 'ذخیره ناموفق بود' },
    );
  };

  const handleTestAi = async () => {
    setAiBusy(true);
    setAiTestResult(null);
    const result = await testAISettings(
      apiKeyInput.trim(),
      baseUrlInput.trim() || 'https://api.gapgpt.app/v1',
      modelInput.trim() || 'gpt-4o-mini',
    );
    setAiBusy(false);
    setAiTestResult(result);
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermissions();
      updatePreferences({ notificationsEnabled: granted });
      if (!granted) {
        setAiTestResult({ success: false, message: 'مرورگر مجوز اعلان را رد کرد' });
      }
    } else {
      updatePreferences({ notificationsEnabled: false });
    }
  };

  // Weekly report
  const start = getStartOfWeek(getTodayJalali());
  const end = getEndOfWeek(getTodayJalali());
  const startISO = gregorianToISO(toGregorian(start.year, start.month, start.day));
  const endISO = gregorianToISO(toGregorian(end.year, end.month, end.day));
  const weekTasks = tasks.filter((t) => t.dueDate >= startISO && t.dueDate <= endISO);
  const completed = weekTasks.filter((t) => t.status === 'completed').length;
  const pending = weekTasks.filter((t) => t.status === 'pending').length;
  const weeklyInsight = managerAi.generateWeeklyInsight(completed, pending);

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-slate-800">بیشتر</h2>

      {/* Weekly report */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-5"
      >
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
          گزارش هفتگی
        </h3>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-green-50 p-3 text-center">
            <p className="text-lg font-bold text-green-600">{toFaDigits(completed)}</p>
            <p className="text-[11px] text-green-500">انجام‌شده</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-3 text-center">
            <p className="text-lg font-bold text-amber-600">{toFaDigits(pending)}</p>
            <p className="text-[11px] text-amber-500">باقی‌مانده</p>
          </div>
        </div>
        <p className="text-right text-xs leading-6 text-slate-500">{weeklyInsight}</p>
      </motion.section>

      {/* Preferences */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass space-y-4 rounded-3xl p-5"
      >
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Clock className="h-4 w-4 text-teal-600" />
          ساعات کاری و یادآوری
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">شروع کار</label>
            <input
              type="time"
              value={preferences?.workStart ?? '08:00'}
              onChange={(e) => updatePreferences({ workStart: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">پایان کار</label>
            <input
              type="time"
              value={preferences?.workEnd ?? '20:00'}
              onChange={(e) => updatePreferences({ workEnd: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-ring"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-slate-500">یادآوری پیش‌فرض (دقیقه قبل)</label>
          <select
            value={preferences?.defaultReminder ?? 15}
            onChange={(e) => updatePreferences({ defaultReminder: Number(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus-ring"
          >
            {[5, 10, 15, 30, 60].map((m) => (
              <option key={m} value={m}>
                {toFaDigits(m)} دقیقه
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-slate-600">
            <Bell className="h-4 w-4 text-indigo-500" />
            اعلان‌های یادآوری
          </span>
          <input
            type="checkbox"
            checked={preferences?.notificationsEnabled ?? false}
            onChange={(e) => void handleToggleNotifications(e.target.checked)}
            className="h-5 w-5 accent-indigo-600"
          />
        </label>
      </motion.section>


      {/* AI settings */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass space-y-3 rounded-3xl p-5"
      >
        <button onClick={() => setShowAi((v) => !v)} className="flex w-full items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            تنظیمات هوش مصنوعی
          </h3>
          <span className="text-xs text-indigo-500">{showAi ? 'بستن' : 'تنظیم'}</span>
        </button>

        {showAi && (
          <div className="space-y-3 pt-1">
            <p className="rounded-xl bg-indigo-50 p-3 text-[11px] leading-5 text-indigo-600">
              برای فعال شدن گفتگوی AI، کلید API خودت رو وارد کن. بدون کلید هم دستیار با پردازش محلی
              (آفلاین) کار می‌کنه.
            </p>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-500">
                <Key className="h-3 w-3" /> کلید API
              </label>
              <div className="flex items-center gap-1">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  dir="ltr"
                  placeholder="sk-..."
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus-ring"
                />
                <button
                  onClick={() => setShowApiKey((v) => !v)}
                  className="p-2 text-slate-400 hover:text-slate-600"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-500">
                <Globe className="h-3 w-3" /> آدرس API
              </label>
              <input
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus-ring"
              />
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-500">
                <Cpu className="h-3 w-3" /> مدل
              </label>
              <input
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                dir="ltr"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus-ring"
              />
            </div>

            {aiTestResult && (
              <div
                className={`flex items-center gap-2 rounded-xl p-3 text-xs ${
                  aiTestResult.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}
              >
                {aiTestResult.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {aiTestResult.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => void handleTestAi()}
                disabled={aiBusy || !apiKeyInput.trim()}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                تست اتصال
              </button>
              <button
                onClick={() => void handleSaveAi()}
                disabled={aiBusy || !apiKeyInput.trim()}
                className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                ذخیره
              </button>
            </div>
            {aiConfig && (
              <p className="text-center text-[10px] text-slate-400">
                وضعیت: {aiConfig.enabled ? 'فعال' : 'غیرفعال'} • {aiConfig.model}
              </p>
            )}
          </div>
        )}
      </motion.section>

      {/* Account */}
      <div className="rounded-3xl bg-slate-100/70 p-4 text-center">
        <p className="text-xs text-slate-500">
          وارد شده به‌عنوان{' '}
          <span className="font-semibold text-slate-700">{user?.full_name || 'کاربر'}</span>
        </p>
        <p className="mt-1 text-[10px] text-slate-400">مدیر من — نسخه ۱.۰</p>
      </div>
    </div>
  );
}

