import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import {
  examSaveProgressApi,
  examStateApi,
  examSubmitApi,
  type ExamQuestion,
  type ExamState,
} from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { toPersianDigits } from '@/utils/jalali';

const OPTION_KEYS = ['1', '2', '3', '4'] as const;

function optionField(q: ExamQuestion, i: number): string {
  return (q as unknown as Record<string, string>)[`option${OPTION_KEYS[i]}`] ?? '';
}

function remainingSeconds(expiresAt: string): number {
  // Server clock drives the deadline; local clock only counts it down.
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function fmtTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return toPersianDigits(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
}

export function ExamRun() {
  const setPage = useAppStore((s) => s.setPage);
  const activeAttemptId = useAppStore((s) => s.activeAttemptId);
  const setResultAttemptId = useAppStore((s) => s.setResultAttemptId);
  const setExamRunning = useAppStore((s) => s.setExamRunning);
  const showToast = useAppStore((s) => s.showToast);

  const [state, setState] = useState<ExamState | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const submitRef = useRef(false);

  // ── Load exam state ────────────────────────────────────────
  useEffect(() => {
    if (!activeAttemptId) {
      setPage('exam-intro');
      return;
    }
    let alive = true;
    examStateApi(activeAttemptId)
      .then((s) => {
        if (!alive) return;
        setState(s);
        setExamRunning(s.status === 'in_progress');
        if (s.status !== 'in_progress') {
          // Attempt already closed server-side → jump to its result
          setResultAttemptId(s.attempt_id);
          setPage('exam-result');
          return;
        }
        setTimeLeft(remainingSeconds(s.expires_at));
        // Resume at the first unanswered question
        const firstUnanswered = s.questions.findIndex((q) => !s.answers[q.id]);
        setCurrent(firstUnanswered >= 0 ? firstUnanswered : 0);
      })
      .catch((err) => {
        if (!alive) return;
        showToast(err instanceof Error ? err.message : 'خطا در بارگذاری آزمون');
        setPage('exam-intro');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; setExamRunning(false); };
  }, [activeAttemptId, setPage, setResultAttemptId, setExamRunning, showToast]);

  // ── Countdown (client) + hard deadline check against server time ──
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { handleAutoExpire(); return; }
    const t = setTimeout(() => setTimeLeft((v) => (v === null ? null : v - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const finishToResult = useCallback(() => {
    setExamRunning(false);
    if (state) setResultAttemptId(state.attempt_id);
    setPage('exam-result');
  }, [state, setResultAttemptId, setPage, setExamRunning]);

  const doSubmit = useCallback(async () => {
    if (submitRef.current) return;
    submitRef.current = true;
    setSubmitting(true);
    try {
      if (activeAttemptId) await examSubmitApi(activeAttemptId);
      finishToResult();
    } catch (err) {
      submitRef.current = false;
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : 'خطا در ثبت نهایی';
      showToast(msg);
      // 410 = time over → server already graded; go to result anyway
      if (msg.includes('پایان')) finishToResult();
    }
  }, [activeAttemptId, finishToResult, showToast]);

  const handleAutoExpire = useCallback(() => {
    setExpired(true);
    doSubmit();
  }, [doSubmit]);

  const questions = state?.questions ?? [];
  const answers = state?.answers ?? {};
  const q = questions[current];
  const answeredCount = useMemo(
    () => questions.filter((qq) => (answers[qq.id] ?? 0) > 0).length,
    [questions, answers],
  );

  // ── Select an option: optimistic update + server persistence ──
  const select = (optIndex: number) => {
    if (!state || !q || submitting) return;
    const selected = optIndex + 1;
    setState({ ...state, answers: { ...answers, [q.id]: selected } });
    examSaveProgressApi(state.attempt_id, q.id, selected).catch(() => {
      showToast('ذخیره پاسخ ناموفق بود؛ اتصال اینترنت را بررسی کنید');
    });
  };

  // Mark an id as being saved (visual feedback)
  const markSaving = (id: string, on: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  };

  const goPrev = () => setCurrent((c) => Math.max(0, c - 1));
  const goNext = () => setCurrent((c) => Math.min(questions.length - 1, c + 1));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="text-sm text-ink-500">در حال بارگذاری آزمون…</p>
      </div>
    );
  }

  if (!state || !q) return null;

  const dangerTime = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="space-y-4">
      {/* Sticky header: timer + progress */}
      <div className="sticky top-14 lg:top-2 z-20 glass rounded-2xl p-4 shadow-glass">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-ink-700">
            سؤال {toPersianDigits(current + 1)} از {toPersianDigits(questions.length)}
          </div>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-sm font-bold ${
              dangerTime ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-primary-100 text-primary-700'
            }`}
          >
            <span className="text-xs font-sans">زمان باقی‌مانده</span>
            {timeLeft !== null ? fmtTime(timeLeft) : '—'}
          </div>
        </div>
        {/* progress bar */}
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-300"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
        <div className="text-xs text-ink-500 mt-1.5">
          {toPersianDigits(answeredCount)} پاسخ ثبت‌شده از {toPersianDigits(questions.length)}
        </div>
      </div>

      {/* Question card */}
      <div className="glass rounded-2xl p-5">
        <p className="font-semibold text-ink-900 leading-8 mb-5">{q.text}</p>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => {
            const opt = optionField(q, i);
            if (!opt) return null;
            const selected = (answers[q.id] ?? 0) === i + 1;
            return (
              <button
                key={i}
                onClick={() => select(i)}
                disabled={submitting}
                className={`w-full text-right rounded-xl border-2 p-4 transition-all flex items-start gap-3 ${
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 bg-white hover:border-primary-300'
                }`}
              >
                <span
                  className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                    selected ? 'border-primary-500 bg-primary-500 text-white' : 'border-slate-300 text-ink-400'
                  }`}
                >
                  {toPersianDigits(i + 1)}
                </span>
                <span className="text-sm text-ink-800 leading-7">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Question navigation dots */}
      <div className="flex flex-wrap gap-2 justify-center">
        {questions.map((qq, i) => {
          const answered = (answers[qq.id] ?? 0) > 0;
          return (
            <button
              key={qq.id}
              onClick={() => setCurrent(i)}
              className={`h-8 min-w-8 px-2 rounded-lg text-xs font-bold transition-colors ${
                i === current
                  ? 'bg-primary-600 text-white'
                  : answered
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-slate-100 text-ink-400'
              }`}
            >
              {toPersianDigits(i + 1)}
            </button>
          );
        })}
      </div>

      {/* Prev / Next / Submit */}
      <div className="flex gap-3">
        <button
          onClick={goPrev}
          disabled={current === 0}
          className="flex-1 py-3 rounded-xl bg-slate-100 text-ink-700 font-semibold disabled:opacity-40 flex items-center justify-center gap-1"
        >
          <ChevronRight className="h-5 w-5" />
          قبلی
        </button>
        {current < questions.length - 1 ? (
          <button
            onClick={goNext}
            className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-semibold flex items-center justify-center gap-1"
          >
            بعدی
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Send className="h-5 w-5" />
            ثبت نهایی
          </button>
        )}
      </div>

      {savingIds.size > 0 && (
        <p className="text-center text-xs text-ink-400 flex items-center justify-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          در حال ذخیره…
        </p>
      )}

      {/* Submit confirmation — ماده ۷-۳: دریافت پیام پایان آزمون */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2 text-amber-600 font-bold">
              <AlertTriangle className="h-5 w-5" />
              ثبت نهایی پاسخ‌ها
            </div>
            <p className="text-sm text-ink-600 leading-7">
              شما به {toPersianDigits(answeredCount)} سؤال از {toPersianDigits(questions.length)} سؤال پاسخ داده‌اید.
              {answeredCount < questions.length && ' سؤالات بی‌پاسخ امتیازی دریافت نمی‌کنند.'}
              {' '}پس از ثبت، امکان تغییر پاسخ‌ها وجود ندارد.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-ink-700 font-semibold text-sm"
              >
                بازگشت
              </button>
              <button
                onClick={() => { setConfirmOpen(false); doSubmit(); }}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                ثبت نهایی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Time-over overlay */}
      {expired && submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-3 text-center">
            <Clock className="h-10 w-10 text-rose-500 mx-auto" />
            <p className="font-bold text-ink-900">زمان آزمون به پایان رسید</p>
            <p className="text-sm text-ink-500">پاسخ‌های ثبت‌شده در حال تصحیح است…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Clock(props: { className?: string }) {
  // small inline icon to avoid extra import churn
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
