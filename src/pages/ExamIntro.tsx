import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Clock, FileText, ListChecks, Loader2, ShieldCheck } from 'lucide-react';
import { examStatusApi, examStartApi, type ExamStatus } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { useProfileStore } from '@/store/profileStore';
import { toPersianDigits } from '@/utils/jalali';

export function ExamIntro() {
  const setPage = useAppStore((s) => s.setPage);
  const setActiveAttemptId = useAppStore((s) => s.setActiveAttemptId);
  const showToast = useAppStore((s) => s.showToast);
  const profile = useProfileStore((s) => s.profile);

  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    examStatusApi()
      .then((s) => { if (alive) setStatus(s); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'خطا در دریافت وضعیت آزمون'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await examStartApi();
      setActiveAttemptId(res.attempt_id);
      setPage('exam-run');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در شروع آزمون');
      setStarting(false);
    }
  };

  const resume = () => {
    if (!status?.active_attempt) return;
    setActiveAttemptId(status.active_attempt.id);
    setPage('exam-run');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const exam = status?.exam;
  const canStart = !!exam?.is_active
    && status!.remaining_attempts > 0
    && (!exam!.require_profile_complete || !!profile?.profile_complete)
    && !status!.active_attempt
    && (exam!.question_count <= 0 || status!.available_questions > 0);

  const blockers: string[] = [];
  if (exam) {
    if (!exam.is_active) blockers.push('آزمون در حال حاضر فعال نیست. لطفاً بعداً مراجعه کنید.');
    else if (exam.require_profile_complete && !profile?.profile_complete)
      blockers.push('برای شرکت در آزمون، ابتدا اطلاعات پروفایل خود را کامل کنید.');
    else if (status!.remaining_attempts <= 0)
      blockers.push('شما تعداد مجاز دفعات شرکت در آزمون را استفاده کرده‌اید.');
    else if (exam.question_count > 0 && status!.available_questions === 0)
      blockers.push('در حال حاضر سؤالی برای آزمون ثبت نشده است.');
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary-100 flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">{exam?.title ?? 'آزمون تخصصی'}</h1>
          <p className="text-sm text-ink-500">دستورالعمل و شرایط شرکت در آزمون</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-700">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Resumable attempt */}
      {status?.active_attempt && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
          <div className="flex items-center gap-2 text-amber-700 font-semibold mb-1">
            <Clock className="h-5 w-5" />
            آزمون ناتمام
          </div>
          <p className="text-sm text-amber-700 mb-4">
            شما یک آزمون در حال اجرا دارید. زمان باقی‌مانده از سرور محاسبه می‌شود؛ در صورت اتمام وقت، پاسخ‌های ثبت‌شده به‌صورت خودکار تصحیح می‌شوند.
          </p>
          <button
            onClick={resume}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
          >
            ادامه آزمون
          </button>
        </div>
      )}

      {/* دستورالعمل آزمون — ماده ۷-۳ */}
      <div className="glass rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-bold text-ink-900 mb-4">
          <BookOpen className="h-5 w-5 text-primary-500" />
          دستورالعمل آزمون
        </h2>
        <ul className="space-y-3 text-sm text-ink-700">
          <li className="flex gap-2">
            <ListChecks className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" />
            <span>آزمون شامل حداکثر <b>{toPersianDigits(exam?.question_count ?? 0)}</b> سؤال چهارگزینه‌ای است.</span>
          </li>
          <li className="flex gap-2">
            <Clock className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" />
            <span>زمان آزمون <b>{toPersianDigits(exam?.duration_minutes ?? 0)}</b> دقیقه است؛ تایمر از سمت سرور کنترل می‌شود و با بستن برنامه متوقف نمی‌شود.</span>
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" />
            <span>هر پاسخ به‌محض انتخاب، روی سرور ذخیره می‌شود؛ در صورت قطعی اینترنت می‌توانید ادامه دهید.</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" />
            <span>پاسخ صحیح امتیاز دارد؛ پاسخ نادرست یا بدون پاسخ امتیازی ندارد.</span>
          </li>
          <li className="flex gap-2">
            <FileText className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" />
            <span>در پایان، نتیجه در پرونده شما ثبت می‌شود
              {exam && !exam.show_result_to_user ? ' و نمایش نمره مطابق سیاست سامانه به کاربر غیرفعال است.' : '.'}
            </span>
          </li>
          {exam && (
            <li className="flex gap-2">
              <ShieldCheck className="h-4 w-4 text-primary-400 mt-0.5 shrink-0" />
              <span>حدنصاب قبولی: <b>{toPersianDigits(exam.pass_score_percent)}٪</b> — حداکثر دفعات شرکت: <b>{toPersianDigits(exam.max_attempts)}</b> بار.</span>
            </li>
          )}
        </ul>
      </div>

      {/* Attempt stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary-600">{toPersianDigits(status?.used_attempts ?? 0)}</div>
          <div className="text-xs text-ink-500 mt-1">دفعات شرکت‌شده</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary-600">{toPersianDigits(status?.remaining_attempts ?? 0)}</div>
          <div className="text-xs text-ink-500 mt-1">دفعات باقی‌مانده</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary-600">{profile?.profile_complete ? '✓' : '—'}</div>
          <div className="text-xs text-ink-500 mt-1">تکمیل پروفایل</div>
        </div>
      </div>

      {/* Start / blockers */}
      {status?.active_attempt ? null : canStart ? (
        <button
          onClick={() => { start().catch(() => showToast('خطا در شروع آزمون')); }}
          disabled={starting}
          className="w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-bold text-lg shadow-glass transition-colors flex items-center justify-center gap-2"
        >
          {starting && <Loader2 className="h-5 w-5 animate-spin" />}
          {starting ? 'در حال آماده‌سازی…' : 'شروع آزمون'}
        </button>
      ) : blockers.length > 0 ? (
        <div className="rounded-2xl bg-slate-100 border border-slate-200 p-5 text-sm text-ink-600 space-y-2">
          {blockers.map((b, i) => (
            <p key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              {b}
            </p>
          ))}
          {exam?.require_profile_complete && !profile?.profile_complete && (
            <button
              onClick={() => setPage('profile')}
              className="mt-2 w-full py-2.5 rounded-lg bg-primary-600 text-white font-semibold text-sm"
            >
              تکمیل پروفایل
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
