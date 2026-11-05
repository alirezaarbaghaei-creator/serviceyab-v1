import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Hourglass, Loader2, XCircle } from 'lucide-react';
import { examResultApi, type ExamResult } from '@/lib/api';
import { useAppStore } from '@/store/appStore';
import { toPersianDigits } from '@/utils/jalali';

export function ExamResultPage() {
  const setPage = useAppStore((s) => s.setPage);
  const resultAttemptId = useAppStore((s) => s.resultAttemptId);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultAttemptId) {
      setPage('dashboard');
      return;
    }
    let alive = true;
    examResultApi(resultAttemptId)
      .then((r) => { if (alive) setResult(r); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'خطا در دریافت نتیجه'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [resultAttemptId, setPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="space-y-4 text-center py-12">
        <XCircle className="h-12 w-12 text-rose-400 mx-auto" />
        <p className="text-sm text-ink-600">{error ?? 'نتیجه‌ای یافت نشد'}</p>
        <button
          onClick={() => setPage('dashboard')}
          className="px-6 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm"
        >
          بازگشت به داشبورد
        </button>
      </div>
    );
  }

  const completed = result.status === 'completed';
  const showScore = completed && result.show_result;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary-100 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">نتیجه آزمون</h1>
          <p className="text-sm text-ink-500">وضعیت شرکت در آزمون شما</p>
        </div>
      </div>

      <div className={`glass rounded-2xl p-6 text-center space-y-3 ${completed ? '' : 'bg-amber-50'}`}>
        {completed ? (
          showScore ? (
            <>
              {result.passed ? (
                <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
              ) : (
                <XCircle className="h-14 w-14 text-rose-500 mx-auto" />
              )}
              <p className="text-3xl font-bold text-ink-900">
                {toPersianDigits(result.score ?? 0)} <span className="text-lg text-ink-400">از {toPersianDigits(result.total ?? 0)}</span>
              </p>
              <p className={`font-bold ${result.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                {result.passed ? 'قبول' : 'مردود'}
              </p>
              <p className="text-sm text-ink-500">
                نتیجه آزمون در پرونده شما ثبت شد و برای بررسی توسط شرکت ارسال گردید.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
              <p className="font-bold text-ink-900">پاسخ‌های شما با موفقیت ثبت شد</p>
              <p className="text-sm text-ink-500 leading-7">
                آزمون شما تکمیل شد و در پرونده‌تان ثبت گردید. نتیجه پس از بررسی توسط کارشناسان از طریق همین پنل به شما اعلام خواهد شد.
              </p>
            </>
          )
        ) : (
          <>
            <Hourglass className="h-14 w-14 text-amber-500 mx-auto" />
            <p className="font-bold text-ink-900">آزمون هنوز تکمیل نشده است</p>
            <p className="text-sm text-ink-500">وضعیت فعلی: در حال اجرا</p>
          </>
        )}
      </div>

      <button
        onClick={() => setPage('dashboard')}
        className="w-full py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold transition-colors"
      >
        بازگشت به داشبورد
      </button>
    </div>
  );
}
