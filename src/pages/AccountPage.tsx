import { useState } from 'react';
import {
  CheckCircle2, KeyRound, Loader2, LogOut, Phone, User,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import { STATUS_LABELS, type ApplicantStatus } from '@/types';
import * as api from '@/lib/api';

/** Shown in the account page. Keep in sync with android/app/build.gradle. */
const APP_VERSION_LABEL = '1.0.0';
const APP_BUILD_NUMBER = '1';

export function AccountPage() {
  const showToast = useAppStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const signOut = useAuthStore((s) => s.signOut);

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [password, setPassword] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [passSaved, setPassSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveName = async () => {
    if (!fullName.trim()) { setError('نام نمی‌تواند خالی باشد'); return; }
    setSavingName(true);
    setError(null);
    try {
      const updated = await api.updateAccount(fullName.trim());
      if (updated) setUser(updated);
      setNameSaved(true);
      showToast('نام با موفقیت ویرایش شد');
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره نام');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    if (password.length < 4) { setError('رمز عبور باید حداقل ۴ کاراکتر باشد'); return; }
    setSavingPass(true);
    setError(null);
    try {
      await api.setPassword(password);
      setPassword('');
      setPassSaved(true);
      showToast('رمز عبور با موفقیت تغییر کرد');
      setTimeout(() => setPassSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در تغییر رمز');
    } finally {
      setSavingPass(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">حساب کاربری</h1>
        <p className="text-sm text-ink-500 mt-1">مشاهده و ویرایش اطلاعات حساب</p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">{error}</div>
      )}

      {/* Account summary */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <User className="h-4 w-4 text-ink-400" />
            نام و نام خانوادگی
          </div>
          <span className="font-semibold text-ink-900">{user?.full_name || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-ink-600">
            <Phone className="h-4 w-4 text-ink-400" />
            شماره موبایل
          </div>
          <span className="font-semibold text-ink-900" dir="ltr">{user?.phone}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-600">وضعیت درخواست همکاری</span>
          <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-bold text-primary-700">
            {STATUS_LABELS[(user?.status ?? 'new') as ApplicantStatus]}
          </span>
        </div>
      </div>

      {/* Edit name */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-ink-900 text-sm">ویرایش نام</h2>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="نام و نام خانوادگی"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus-ring"
        />
        <button
          onClick={saveName}
          disabled={savingName}
          className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : nameSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
          {nameSaved ? 'ذخیره شد' : 'ذخیره نام'}
        </button>
      </div>

      {/* Change password */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-ink-900 text-sm flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary-500" />
          تغییر رمز عبور
        </h2>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="رمز عبور جدید (حداقل ۴ کاراکتر)"
          dir="ltr"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-left focus-ring"
        />
        <button
          onClick={savePassword}
          disabled={savingPass || !password}
          className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {savingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : passSaved ? <CheckCircle2 className="h-4 w-4" /> : null}
          {passSaved ? 'ذخیره شد' : 'تغییر رمز'}
        </button>
      </div>

      <button
        onClick={handleSignOut}
        className="w-full py-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        خروج از حساب کاربری
      </button>

      <p className="text-center text-xs text-ink-400">
        سرویس‌یاب — نسخه {APP_VERSION_LABEL} (بیلد {APP_BUILD_NUMBER})
      </p>
    </div>
  );
}
