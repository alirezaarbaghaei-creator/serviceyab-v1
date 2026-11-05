import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3, CheckCircle2, ChevronLeft, ClipboardList, Download, Eye, FileText,
  KeyRound, Loader2, LogOut, MessageSquare, Pencil, Plus, Search, Settings2,
  Trash2, Users, X,
} from 'lucide-react';
import * as api from '@/lib/api';
import type {
  AdminApplicantRow, AdminApplicantRow as Row, AdminQuestion, AdminSettings,
  AdminStats, AdminExamSettings,
} from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { STATUS_LABELS, STATUS_COLORS, type ApplicantStatus } from '@/types';
import { toPersianDigits } from '@/utils/jalali';
import { downloadTextFile } from '@/lib/download';

type Tab = 'stats' | 'applicants' | 'questions' | 'exam' | 'sms' | 'admins';

// ─── Shared UI bits ───────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
    </div>
  );
}

function StatCard({ label, value, tone = 'primary' }: { label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700 border-primary-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
  };
  return (
    <div className={`rounded-2xl border p-4 text-center ${tones[tone] ?? tones.primary}`}>
      <div className="text-2xl font-bold">{toPersianDigits(value)}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}

// ─── Stats tab (ماده ۸-۲) ─────────────────────────────────────

function StatsTab({ stats }: { stats: AdminStats | null }) {
  if (!stats) return <Spinner />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatCard label="کل متقاضیان" value={stats.total_applicants} />
      <StatCard label="متقاضیان جدید" value={stats.new_applicants} tone="sky" />
      <StatCard label="در حال بررسی" value={stats.in_review} tone="amber" />
      <StatCard label="تأیید اولیه" value={stats.approved} tone="emerald" />
      <StatCard label="ردشده" value={stats.rejected} tone="rose" />
      <StatCard label="شرکت‌کنندگان آزمون" value={stats.exam_participants} />
    </div>
  );
}

// ─── Applicants tab (ماده ۸-۳ تا ۸-۶) ─────────────────────────

function ApplicantsTab({ onOpenFile }: { onOpenFile: (id: string) => void }) {
  const [rows, setRows] = useState<AdminApplicantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [examFilter, setExamFilter] = useState<'' | 'none' | 'completed'>('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (q?: { search?: string; status?: string; exam_status?: '' | 'none' | 'completed' }) => {
    setLoading(true);
    try {
      const data = await api.adminApplicantsListApi({
        search: q?.search ?? '',
        status: q?.status ?? '',
        exam_status: q?.exam_status ?? '',
      });
      setRows(data);
    } catch { /* handled by caller */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doExport = async () => {
    setExporting(true);
    try {
      const csv = await api.adminApplicantsExportApi();
      // BOM keeps Persian text readable in Excel (ماده ۸-۷: سازگاری با صفحه‌گسترده)
      downloadTextFile('serviceyab-applicants.csv', '\uFEFF' + csv, 'text/csv;charset=utf-8');
    } catch { /* noop */ }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters — ماده ۸-۴ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load({ search, status: statusFilter, exam_status: examFilter })}
            placeholder="جست‌وجوی نام یا شماره تماس…"
            className="w-full rounded-xl border border-slate-200 bg-white pr-10 pl-4 py-2.5 text-sm focus-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { const v = e.target.value; setStatusFilter(v); load({ search, status: v, exam_status: examFilter }); }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus-ring"
        >
          <option value="">همه وضعیت‌ها</option>
          <option value="new">جدید</option>
          <option value="in_review">در حال بررسی</option>
          <option value="approved">تأیید اولیه</option>
          <option value="rejected">ردشده</option>
        </select>
        <select
          value={examFilter}
          onChange={(e) => { const v = e.target.value as '' | 'none' | 'completed'; setExamFilter(v); load({ search, status: statusFilter, exam_status: v }); }}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus-ring"
        >
          <option value="">همه وضعیت‌های آزمون</option>
          <option value="none">شرکت نکرده</option>
          <option value="completed">شرکت کرده</option>
        </select>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-ink-500">{toPersianDigits(rows.length)} متقاضی</span>
        <button
          onClick={doExport}
          disabled={exporting}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-white text-sm font-semibold disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          خروجی CSV
        </button>
      </div>

      {/* Table — ماده ۸-۳ */}
      {loading ? <Spinner /> : rows.length === 0 ? (
        <p className="text-center text-sm text-ink-400 py-10">متقاضی‌ای یافت نشد</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 text-ink-600 text-xs">
                <th className="p-3 text-right font-semibold">نام</th>
                <th className="p-3 text-right font-semibold">تماس</th>
                <th className="p-3 text-right font-semibold">شهر</th>
                <th className="p-3 text-right font-semibold">ثبت‌نام</th>
                <th className="p-3 text-right font-semibold">وضعیت بررسی</th>
                <th className="p-3 text-right font-semibold">آزمون</th>
                <th className="p-3 text-right font-semibold">نمره</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="p-3 font-medium text-ink-900">
                    {r.full_name || '—'}
                    {!r.profile_complete && <span className="mr-1 text-[10px] text-amber-600">(پروفایل ناقص)</span>}
                  </td>
                  <td className="p-3" dir="ltr">{r.phone}</td>
                  <td className="p-3 text-ink-600">{r.city || '—'}</td>
                  <td className="p-3 text-ink-600 text-xs">{r.created_at?.slice(0, 10)}</td>
                  <td className="p-3">
                    <select
                      value={r.status}
                      onChange={async (e) => {
                        const v = e.target.value;
                        setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: v as ApplicantStatus } : x)));
                        try { await api.adminApplicantSetStatusApi(r.id, v); }
                        catch { setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: r.status } : x))); }
                      }}
                      className={`rounded-lg border-0 px-2 py-1 text-xs font-bold cursor-pointer focus:ring-2 focus:ring-primary-300 ${STATUS_COLORS[r.status as ApplicantStatus]}`}
                    >
                      <option value="new">جدید</option>
                      <option value="in_review">در حال بررسی</option>
                      <option value="approved">تأیید اولیه</option>
                      <option value="rejected">ردشده</option>
                    </select>
                  </td>
                  <td className="p-3 text-ink-600 text-xs">{r.attempt_status ? 'شرکت کرده' : 'شرکت نکرده'}</td>
                  <td className="p-3 text-ink-800 font-bold">
                    {r.attempt_score !== null ? `${toPersianDigits(r.attempt_score)}/${toPersianDigits(r.attempt_total ?? 0)}` : '—'}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => onOpenFile(r.id)}
                      className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      پرونده
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Applicant file view (ماده ۸-۵) ───────────────────────────

function ApplicantFile({ id, onBack }: { id: string; onBack: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.adminApplicantGetApi>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('new');

  useEffect(() => {
    setLoading(true);
    api.adminApplicantGetApi(id)
      .then((d) => { setData(d); setStatus(d.applicant.status); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Spinner />;
  if (!data) return <p className="text-center text-sm text-ink-400 py-10">پرونده یافت نشد</p>;

  const { applicant, profile, attempts } = data;
  const rows: Array<[string, string | undefined]> = profile ? [
    ['شهر محل سکونت/فعالیت', profile.city],
    ['اطلاعات تماس تکمیلی', profile.contact_extra],
    ['رشته تحصیلی / زمینه آموزشی', profile.education_field],
    ['مقطع تحصیلی / مدرک', profile.education_degree],
    ['مرکز آموزشی', profile.education_center],
    ['دوره‌های تخصصی', profile.courses],
    ['زمینه‌های مهارتی', profile.skill_areas],
    ['سطح مهارت (خوداظهاری)', profile.skill_level],
    ['سابقه فعالیت', profile.experience],
    ['ابزار و تجهیزات', profile.tools],
    ['توضیحات متقاضی', profile.description],
  ] : [];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ChevronLeft className="h-4 w-4" /> بازگشت به فهرست
      </button>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-lg text-ink-900">{applicant.full_name || 'بدون نام'}</h2>
            <p className="text-xs text-ink-500" dir="ltr">{applicant.phone}</p>
            <p className="text-xs text-ink-400 mt-1">ثبت‌نام: {applicant.created_at?.slice(0, 10)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500">تغییر وضعیت:</span>
            <select
              value={status}
              onChange={async (e) => {
                const v = e.target.value;
                setStatus(v);
                try { await api.adminApplicantSetStatusApi(applicant.id, v); } catch { setStatus(applicant.status); }
              }}
              className={`rounded-lg border-0 px-3 py-2 text-xs font-bold cursor-pointer ${STATUS_COLORS[status as ApplicantStatus]}`}
            >
              <option value="new">جدید</option>
              <option value="in_review">در حال بررسی</option>
              <option value="approved">تأیید اولیه</option>
              <option value="rejected">ردشده</option>
            </select>
          </div>
        </div>
      </div>

      {/* Profile info — ماده ۵-۴ */}
      {rows.some(([, v]) => v) ? (
        <div className="glass rounded-2xl p-5">
          <h3 className="font-bold text-sm text-ink-900 mb-3">اطلاعات ثبت‌شده متقاضی</h3>
          <dl className="space-y-2.5">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 border-b border-slate-100 pb-2.5 last:border-0">
                <dt className="text-xs text-ink-400 sm:w-44 shrink-0">{k}</dt>
                <dd className="text-sm text-ink-800 leading-6">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="text-center text-sm text-ink-400 py-6">متقاضی هنوز اطلاعات پروفایل را تکمیل نکرده است</p>
      )}

      {/* Exam attempts — ماده ۷-۶ */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-bold text-sm text-ink-900 mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-amber-500" />
          نتایج آزمون ({toPersianDigits(attempts.length)})
        </h3>
        {attempts.length === 0 ? (
          <p className="text-sm text-ink-400">در آزمون شرکت نکرده است</p>
        ) : (
          <div className="space-y-4">
            {attempts.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                    a.status === 'completed' ? (a.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700') : 'bg-slate-100 text-ink-500'
                  }`}>
                    {a.status === 'completed' ? (a.passed ? 'قبول' : 'مردود') : a.status === 'expired' ? 'پایان زمان' : 'در حال اجرا'}
                  </span>
                  <span className="font-bold text-ink-900">{toPersianDigits(a.score)} از {toPersianDigits(a.total)}</span>
                  <span className="text-xs text-ink-400">شروع: {a.started_at?.slice(0, 16)}</span>
                  {a.finished_at && <span className="text-xs text-ink-400">پایان: {a.finished_at?.slice(0, 16)}</span>}
                </div>
                {/* Answer detail — پاسخ‌های ثبت‌شده */}
                <div className="space-y-2">
                  {a.answers.filter((ans) => ans.text).map((ans) => (
                    <div key={ans.question_id} className={`rounded-lg p-3 text-xs ${ans.is_correct ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                      <p className="font-semibold text-ink-800 mb-1">{ans.text}</p>
                      <p className="text-ink-600">
                        پاسخ متقاضی: {ans.selected_option > 0
                          ? (((ans as unknown as Record<string, string>)[`option${ans.selected_option}`] ?? '—'))
                          : 'بی‌پاسخ'}
                      </p>
                      {!ans.is_correct && (
                        <p className="text-emerald-700 mt-0.5">
                          پاسخ صحیح: {(ans as unknown as Record<string, string>)[`option${ans.correct_option}`] ?? '—'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Questions tab (ماده ۷-۲ و ۷-۴) ───────────────────────────

const EMPTY_Q: Omit<AdminQuestion, 'id'> = {
  text: '', option1: '', option2: '', option3: '', option4: '',
  correct_option: 1, is_active: true,
};

function QuestionsTab() {
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<(AdminQuestion | Omit<AdminQuestion, 'id'> & { id?: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try { setQuestions(await api.adminQuestionsListApi(q)); } catch { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      if ('id' in editing && editing.id) {
        await api.adminQuestionUpdateApi(editing as AdminQuestion);
      } else {
        await api.adminQuestionCreateApi(editing as Omit<AdminQuestion, 'id' | 'created_at'>);
      }
      setEditing(null);
      load(search);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره سؤال');
    } finally {
      setSaving(false);
    }
  };

  const atLimit = questions.length >= 50;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(search)}
            placeholder="جست‌وجوی متن سؤال…"
            className="w-full rounded-xl border border-slate-200 bg-white pr-10 pl-4 py-2.5 text-sm focus-ring"
          />
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY_Q })}
          disabled={atLimit}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-white text-sm font-semibold disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          سؤال جدید
        </button>
      </div>
      <p className="text-xs text-ink-500">
        {toPersianDigits(questions.length)} سؤال از حداکثر ۵۰ سؤال (بند ۷-۲ قرارداد)
      </p>

      {loading ? <Spinner /> : questions.length === 0 ? (
        <p className="text-center text-sm text-ink-400 py-10">سؤالی ثبت نشده است</p>
      ) : (
        <div className="space-y-2">
          {questions.map((qq) => (
            <div key={qq.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-ink-800 leading-6 flex-1">{qq.text}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={async () => {
                      setQuestions((prev) => prev.map((x) => (x.id === qq.id ? { ...x, is_active: !x.is_active } : x)));
                      try { await api.adminQuestionToggleApi(qq.id, !qq.is_active); } catch { load(search); }
                    }}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold ${qq.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-ink-400'}`}
                  >
                    {qq.is_active ? 'فعال' : 'غیرفعال'}
                  </button>
                  <button onClick={() => setEditing(qq)} className="rounded-lg p-1.5 text-sky-600 hover:bg-sky-50">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      setQuestions((prev) => prev.filter((x) => x.id !== qq.id));
                      try { await api.adminQuestionDeleteApi(qq.id); } catch { load(search); }
                    }}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                {[1, 2, 3, 4].map((i) => {
                  const opt = (qq as unknown as Record<string, string>)[`option${i}`];
                  if (!opt) return null;
                  return (
                    <span key={i} className={i === qq.correct_option ? 'font-bold text-emerald-700' : 'text-ink-500'}>
                      {i === qq.correct_option ? '✓ ' : ''}{opt}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="glass rounded-2xl p-6 w-full max-w-lg space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-ink-900">{'id' in editing && editing.id ? 'ویرایش سؤال' : 'سؤال جدید'}</h3>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1 text-ink-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error}</p>}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-600">متن سؤال *</span>
              <textarea
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm resize-none focus-ring"
              />
            </label>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={editing.correct_option === i}
                  onChange={() => setEditing({ ...editing, correct_option: i })}
                  className="h-4 w-4 accent-emerald-600 shrink-0"
                  title="پاسخ صحیح"
                />
                <input
                  value={(editing as unknown as Record<string, string>)[`option${i}`] ?? ''}
                  onChange={(e) => setEditing({ ...editing, [`option${i}`]: e.target.value })}
                  placeholder={`گزینه ${i}`}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus-ring"
                />
              </div>
            ))}
            <p className="text-[11px] text-ink-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              دایره کنار گزینه را برای تعیین پاسخ صحیح انتخاب کنید (حداقل دو گزینه لازم است).
            </p>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                checked={editing.is_active}
                onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                className="h-4 w-4 accent-primary-600"
              />
              فعال (در آزمون شرکت‌کنندگان ارائه شود)
            </label>
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-ink-700 font-semibold text-sm">
                انصراف
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                ذخیره
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exam settings tab (ماده ۷-۴) ─────────────────────────────

function ExamSettingsTab() {
  const [settings, setSettings] = useState<AdminExamSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.adminExamGetApi().then(setSettings).catch(() => {});
  }, []);

  if (!settings) return <Spinner />;

  const upd = (patch: Partial<AdminExamSettings>) => {
    setSettings({ ...settings, ...patch });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.adminExamSaveApi(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات');
    } finally {
      setSaving(false);
    }
  };

  const num = (label: string, key: 'duration_minutes' | 'question_count' | 'pass_score_percent' | 'max_attempts', min: number, max: number, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={settings[key]}
        onChange={(e) => upd({ [key]: Number(e.target.value) } as Partial<AdminExamSettings>)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus-ring"
      />
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );

  const toggle = (label: string, key: 'is_active' | 'show_result_to_user' | 'require_profile_complete', hint?: string) => (
    <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer">
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(e) => upd({ [key]: e.target.checked } as Partial<AdminExamSettings>)}
        className="h-4 w-4 mt-0.5 accent-primary-600"
      />
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {hint && <span className="block text-xs text-ink-400 mt-0.5">{hint}</span>}
      </span>
    </label>
  );

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">عنوان آزمون</span>
        <input
          type="text"
          value={settings.title}
          onChange={(e) => upd({ title: e.target.value })}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus-ring"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        {num('مدت آزمون (دقیقه)', 'duration_minutes', 1, 300)}
        {num('تعداد سؤالات ارائه‌شده', 'question_count', 1, 50, 'از میان سؤالات فعال، به‌صورت تصادفی انتخاب می‌شود')}
        {num('حدنصاب قبولی (٪)', 'pass_score_percent', 0, 100)}
        {num('حداکثر دفعات شرکت', 'max_attempts', 1, 10)}
      </div>
      {toggle('آزمون فعال باشد', 'is_active', 'در صورت فعال‌بودن، متقاضیان می‌توانند در آزمون شرکت کنند')}
      {toggle('نمایش نمره به متقاضی', 'show_result_to_user', 'در صورت غیرفعال‌بودن، کاربر فقط وضعیت شرکت را می‌بیند و نتیجه در پنل مدیریت قابل مشاهده است')}
      {toggle('الزام تکمیل پروفایل قبل از آزمون', 'require_profile_complete')}
      {error && <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <CheckCircle2 className="h-5 w-5" /> : null}
        {saved ? 'ذخیره شد' : 'ذخیره تنظیمات'}
      </button>
    </div>
  );
}

// ─── SMS settings tab ─────────────────────────────────────────

function SmsTab() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.adminSettingsGet().then(setSettings).catch(() => {});
  }, []);

  if (!settings) return <Spinner />;

  const save = async () => {
    setSaving(true);
    try {
      await api.adminSettingsUpdate({
        sms_api_key: settings.sms_api_key,
        sms_pattern_code: settings.sms_pattern_code,
        sms_line_number: settings.sms_line_number,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* noop */ }
    setSaving(false);
  };

  const field = (label: string, key: keyof AdminSettings, hint?: string, type = 'text') => (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      <input
        type={type}
        dir="ltr"
        value={settings[key]}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-left focus-ring"
      />
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500 leading-6">
        تنظیمات سرویس پیامکی (ایران‌پیامک) برای ارسال کد یک‌بارمصرف ورود. در صورت خالی‌بودن، کد به‌جای ارسال پیامک در پاسخ ورودی برگردانده می‌شود (فقط برای توسعه).
      </p>
      {field('کلید API', 'sms_api_key')}
      {field('کد الگو (Pattern)', 'sms_pattern_code')}
      {field('شماره خط', 'sms_line_number')}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : saved ? <CheckCircle2 className="h-5 w-5" /> : null}
        {saved ? 'ذخیره شد' : 'ذخیره تنظیمات پیامک'}
      </button>
    </div>
  );
}

// ─── Admin accounts tab (ماده ۸-۱) ────────────────────────────

function AdminsTab({ selfId }: { selfId: string | null }) {
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setError(null); setMsg(null);
    setSaving(true);
    try {
      await api.adminUserCreate({ phone, password, full_name: fullName, is_admin: true });
      setMsg('حساب مدیر جدید ایجاد شد');
      setPhone(''); setFullName(''); setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ایجاد حساب');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-500 leading-6">
        در نسخه پایه، حساب‌های دارای مجوز مدیریتی از این بخش ایجاد می‌شوند. برای حذف یا ویرایش حساب‌های مدیریتی، به‌صورت مستقیم در دیتابیس اقدام کنید یا با مجری هماهنگ نمایید (بند ۸-۱ قرارداد).
      </p>
      {error && <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">{error}</p>}
      {msg && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">{msg}</p>}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">شماره موبایل مدیر جدید</span>
        <input
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09123456789"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-left focus-ring"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">نام و نام خانوادگی</span>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus-ring"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-ink-700">رمز عبور</span>
        <input
          type="password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-left focus-ring"
        />
      </label>
      <button
        onClick={create}
        disabled={saving || !phone || !fullName || password.length < 4}
        className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <KeyRound className="h-5 w-5" />}
        ایجاد حساب مدیر
      </button>
      {selfId && <p className="text-center text-[11px] text-ink-300">شناسه حساب شما: {selfId}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  const loadStats = useCallback(async () => {
    try { setStats(await api.adminStatsGet()); } catch { /* noop */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = useMemo(() => [
    { id: 'stats', label: 'آمار', icon: BarChart3 },
    { id: 'applicants', label: 'متقاضیان', icon: Users },
    { id: 'questions', label: 'سؤالات آزمون', icon: FileText },
    { id: 'exam', label: 'تنظیمات آزمون', icon: Settings2 },
    { id: 'sms', label: 'پنل پیامک', icon: MessageSquare },
    { id: 'admins', label: 'مدیران', icon: KeyRound },
  ], []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink-900">پنل مدیریت سرویس‌یاب</h1>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          خروج
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setFileId(null); }}
            className={`flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-primary-600 text-white shadow-glass' : 'glass text-ink-600'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && <StatsTab stats={stats} />}
      {tab === 'applicants' && (
        fileId
          ? <ApplicantFile id={fileId} onBack={() => setFileId(null)} />
          : <ApplicantsTab onOpenFile={(id) => setFileId(id)} />
      )}
      {tab === 'questions' && <QuestionsTab />}
      {tab === 'exam' && <ExamSettingsTab />}
      {tab === 'sms' && <SmsTab />}
      {tab === 'admins' && <AdminsTab selfId={user?.id ?? null} />}
    </div>
  );
}

// keep `Row` referenced for clarity of exported types
export type { Row as AdminApplicantRowType };
