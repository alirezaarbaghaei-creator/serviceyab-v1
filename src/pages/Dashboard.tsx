import { useEffect, useState } from 'react';
import {
  BookOpenCheck, CheckCircle2, ChevronLeft, ClipboardList, CircleDashed,
  FileText, HelpCircle, Loader2, UserRound,
} from 'lucide-react';
import { examStatusApi, type ExamStatus } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAppStore } from '@/store/appStore';
import { useProfileStore } from '@/store/profileStore';
import { STATUS_LABELS, type ApplicantStatus } from '@/types';
import { toPersianDigits } from '@/utils/jalali';

// راهنمای اولیه استفاده از سامانه — ماده ۶ بند ۸
const GUIDE_STEPS = [
  'اطلاعات فردی، آموزشی و تخصصی خود را در بخش «پروفایل» کامل کنید.',
  'در صورت فعال‌بودن آزمون، از بخش «آزمون» دستورالعمل را مطالعه و در آزمون شرکت کنید.',
  'نتیجه بررسی درخواست شما از طریق «وضعیت درخواست» در همین صفحه قابل مشاهده است.',
  'هرگونه تغییر در اطلاعات پروفایل را می‌توانید هر زمان از بخش «پروفایل» اعمال کنید.',
];

export function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const setPage = useAppStore((s) => s.setPage);
  const setResultAttemptId = useAppStore((s) => s.setResultAttemptId);
  const profile = useProfileStore((s) => s.profile);
  const loadProfile = useProfileStore((s) => s.loadProfile);

  const [status, setStatus] = useState<ExamStatus | null>(null);

  useEffect(() => {
    loadProfile();
    examStatusApi().then(setStatus).catch(() => {});
  }, [loadProfile]);

  const reqStatus = (user?.status ?? 'new') as ApplicantStatus;
  const exam = status?.exam;
  const examDone = (status?.used_attempts ?? 0) > 0;
  const hasResumable = !!status?.active_attempt;
  const canTakeExam = !!exam?.is_active && (status?.remaining_attempts ?? 0) > 0
    && (!exam.require_profile_complete || !!profile?.profile_complete);

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-ink-900">سلام، {user?.full_name ?? 'متقاضی'} 👋</h1>
        <p className="text-sm text-ink-500 mt-1">به پنل کاربری سرویس‌یاب خوش آمدید</p>
      </div>

      {/* Request status — ماده ۶ بند ۷ */}
      <button
        onClick={() => setPage('account')}
        className="w-full text-right glass rounded-2xl p-5 flex items-center justify-between hover:shadow-glass transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary-100 flex items-center justify-center">
            <CircleDashed className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <div className="text-xs text-ink-500">وضعیت درخواست همکاری</div>
            <div className="font-bold text-ink-900">{STATUS_LABELS[reqStatus]}</div>
          </div>
        </div>
        <ChevronLeft className="h-5 w-5 text-ink-300" />
      </button>

      {/* Profile completeness — ماده ۶ بند ۲ و ۳ */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-cyan-100 flex items-center justify-center">
              <UserRound className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <div className="font-bold text-ink-900">پروفایل متقاضی</div>
              <div className="text-xs text-ink-500">
                {profile?.profile_complete ? 'اطلاعات شما کامل است' : 'اطلاعات شما کامل نیست'}
              </div>
            </div>
          </div>
          {profile?.profile_complete ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          ) : (
            <button
              onClick={() => setPage('profile')}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold"
            >
              تکمیل
            </button>
          )}
        </div>
        {!profile?.profile_complete && (
          <p className="text-xs text-ink-500 leading-6">
            برای شرکت در آزمون و بررسی درخواست، تکمیل اطلاعات فردی، آموزشی و تخصصی الزامی است.
          </p>
        )}
      </div>

      {/* Exam card — ماده ۶ بند ۴ تا ۶ */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="font-bold text-ink-900">آزمون تخصصی</div>
              <div className="text-xs text-ink-500">
                {!exam?.is_active
                  ? 'در حال حاضر فعال نیست'
                  : examDone
                    ? 'در آزمون شرکت کرده‌اید'
                    : hasResumable
                      ? 'آزمون ناتمام دارید'
                      : canTakeExam
                        ? 'آماده شرکت در آزمون'
                        : 'شرایط شرکت فراهم نیست'}
              </div>
            </div>
          </div>
        </div>

        {hasResumable ? (
          <button
            onClick={() => { setResultAttemptId(status!.active_attempt!.id); setPage('exam-result'); }}
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm mb-2"
          >
            مشاهده وضعیت آزمون در حال اجرا
          </button>
        ) : null}

        <button
          onClick={() => setPage('exam-intro')}
          className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
            canTakeExam && !examDone
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-slate-100 text-ink-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          {examDone ? 'مشاهده دستورالعمل و وضعیت آزمون' : 'مشاهده دستورالعمل آزمون'}
        </button>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setPage('profile')}
          className="glass rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-glass transition-shadow"
        >
          <BookOpenCheck className="h-6 w-6 text-primary-500" />
          <span className="text-sm font-semibold text-ink-800">اطلاعات من</span>
        </button>
        <button
          onClick={() => setPage('account')}
          className="glass rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-glass transition-shadow"
        >
          <HelpCircle className="h-6 w-6 text-primary-500" />
          <span className="text-sm font-semibold text-ink-800">حساب کاربری</span>
        </button>
      </div>

      {/* راهنمای اولیه — ماده ۶ بند ۸ */}
      <div className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink-900 mb-3 text-sm">
          <HelpCircle className="h-4 w-4 text-primary-500" />
          راهنمای اولیه سامانه
        </h2>
        <ol className="space-y-2.5">
          {GUIDE_STEPS.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-xs text-ink-600 leading-6">
              <span className="h-5 w-5 shrink-0 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                {toPersianDigits(i + 1)}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
