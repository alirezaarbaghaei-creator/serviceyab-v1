import { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  Activity, ArrowLeft, Award, BookOpen, Building2, CheckCircle2, ChevronLeft,
  ClipboardList, Clock3, Download, FileText, GraduationCap, LayoutDashboard,
  LogOut, Menu, Search, ShieldCheck, UserRound, Users, Wrench, X
} from 'lucide-react';

type Profile = {
  user_id: string; full_name: string; phone: string; city: string;
  education_field: string; education_level: string; education_center: string;
  completed_courses: string; skills: string[]; self_assessed_level: string;
  experience: string; equipment: string; notes: string;
  status: 'new' | 'reviewing' | 'pre_approved' | 'rejected'; admin_note?: string;
};
type Question = { question_id: string; prompt: string; options: string[]; display_order: number };
type Attempt = { id: string; started_at: string; submitted_at: string | null; score: number | null; status: string; total_questions: number };

const emptyProfile: Partial<Profile> = {
  full_name: '', phone: '', city: '', education_field: '', education_level: '',
  education_center: '', completed_courses: '', skills: [], self_assessed_level: '',
  experience: '', equipment: '', notes: ''
};
const statusLabels: Record<string, string> = {
  new: 'جدید', reviewing: 'در حال بررسی', pre_approved: 'تأیید اولیه', rejected: 'رد شده'
};
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10';
const labelClass = 'mb-2 block text-sm font-semibold text-slate-700';

function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState<'home' | 'profile' | 'exam' | 'admin'>('home');
  const [profile, setProfile] = useState<Partial<Profile>>(emptyProfile);
  const [isAdmin, setIsAdmin] = useState(false);
  const [applicants, setApplicants] = useState<Profile[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [filter, setFilter] = useState('');
  const [exam, setExam] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [examExpiry, setExamExpiry] = useState<string | null>(null);
  const [examResult, setExamResult] = useState<any>(null);
  const [examBusy, setExamBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(emptyProfile);
      setIsAdmin(false);
      return;
    }
    void loadAccount(session.user.id);
  }, [session?.user?.id]);

  async function loadAccount(userId: string) {
    const [{ data: row }, { data: role }] = await Promise.all([
      supabase.from('applicant_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle()
    ]);
    setIsAdmin(!!role);
    if (row) setProfile(row as Profile);
    else setProfile({ ...emptyProfile, user_id: userId, phone: session?.user?.phone ?? '' });
  }

  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const normalized = phone.trim();
      if (!normalized || password.length < 8) throw new Error('شماره همراه و رمز عبور حداقل ۸ کاراکتری را وارد کنید.');
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          phone: normalized, password,
          options: { data: { full_name: authName.trim() } }
        });
        if (error) throw error;
        if (data.session) setMessage('حساب شما ایجاد شد.');
        else setMessage('ثبت‌نام انجام شد. اگر تأیید شماره همراه در تنظیمات فعال است، کد پیامک‌شده را طبق تنظیمات احراز هویت تأیید کنید.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ phone: normalized, password });
        if (error) throw error;
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : 'خطا در احراز هویت'); }
    finally { setBusy(false); }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault(); if (!session?.user) return;
    setBusy(true); setMessage('');
    const payload = {
      user_id: session.user.id,
      full_name: String(profile.full_name || '').trim(),
      phone: String(profile.phone || session.user.phone || '').trim(),
      city: String(profile.city || '').trim(),
      education_field: String(profile.education_field || ''),
      education_level: String(profile.education_level || ''),
      education_center: String(profile.education_center || ''),
      completed_courses: String(profile.completed_courses || ''),
      skills: profile.skills || [],
      self_assessed_level: String(profile.self_assessed_level || ''),
      experience: String(profile.experience || ''),
      equipment: String(profile.equipment || ''),
      notes: String(profile.notes || '')
    };
    try {
      const { error } = await supabase.from('applicant_profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      setProfile(payload);
      setMessage('اطلاعات پرونده ذخیره شد.');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'ذخیره اطلاعات انجام نشد.'); }
    finally { setBusy(false); }
  }

  async function startExam() {
    setExamBusy(true); setMessage(''); setExamResult(null);
    try {
      const { data, error } = await supabase.rpc('start_serviceyab_exam');
      if (error) throw error;
      const rows = (data || []) as any[];
      if (!rows.length) throw new Error('سؤالی برای آزمون دریافت نشد.');
      setAttemptId(rows[0].attempt_id);
      setExamExpiry(rows[0].expires_at);
      setExam(rows.map((r) => ({ question_id: r.question_id, prompt: r.prompt, options: r.options, display_order: r.display_order })));
      setAnswers({});
      setPage('exam');
    } catch (err) { setMessage(err instanceof Error ? err.message : 'شروع آزمون ناموفق بود.'); }
    finally { setExamBusy(false); }
  }

  async function submitExam() {
    if (!attemptId) return;
    setExamBusy(true);
    try {
      const payload = Object.entries(answers).map(([question_id, selected_option]) => ({
        attempt_id: attemptId, question_id, selected_option
      }));
      if (payload.length) {
        const { error: answerError } = await supabase.from('exam_answers').upsert(payload, { onConflict: 'attempt_id,question_id' });
        if (answerError) throw answerError;
      }
      const { data, error } = await supabase.rpc('submit_serviceyab_exam', { p_attempt_id: attemptId });
      if (error) throw error;
      setExamResult(Array.isArray(data) ? data[0] : data);
      setExam([]);
      setMessage('پاسخ‌های شما با موفقیت ثبت شد.');
      await loadAdminData();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'ثبت آزمون ناموفق بود.'); }
    finally { setExamBusy(false); }
  }

  async function loadAdminData() {
    if (!isAdmin) return;
    const [{ data: people, error: peopleError }, { data: results }] = await Promise.all([
      supabase.from('applicant_profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('exam_attempts').select('*').order('created_at', { ascending: false })
    ]);
    if (peopleError) { setMessage(peopleError.message); return; }
    setApplicants((people || []) as Profile[]);
    setAttempts((results || []) as Attempt[]);
  }

  async function changeStatus(userId: string, status: Profile['status']) {
    const { error } = await supabase.rpc('admin_set_applicant_review', {
      p_user_id: userId, p_status: status, p_admin_note: ''
    });
    if (error) setMessage(error.message);
    else await loadAdminData();
  }

  function exportCsv() {
    const headers = ['نام و نام خانوادگی','شماره همراه','شهر','رشته تحصیلی','مقطع','مهارت‌ها','سابقه','وضعیت'];
    const rows = applicants.map(p => [p.full_name,p.phone,p.city,p.education_field,p.education_level,(p.skills||[]).join('، '),p.experience,statusLabels[p.status] || p.status]);
    const csv = '\uFEFF' + [headers, ...rows].map(row => row.map(v => '"' + String(v ?? '').replaceAll('"','""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'serviceyab-applicants.csv'; a.click(); URL.revokeObjectURL(url);
  }

  useEffect(() => { if (page === 'admin' && isAdmin) void loadAdminData(); }, [page, isAdmin]);
  const filteredApplicants = useMemo(() => applicants.filter(p =>
    [p.full_name,p.phone,p.city].some(v => String(v || '').includes(filter))
  ), [applicants, filter]);

  if (!isSupabaseConfigured) return <SetupScreen />;
  if (authLoading) return <div className="grid min-h-screen place-items-center text-slate-500">در حال بررسی نشست کاربری…</div>;
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} phone={phone} setPhone={setPhone}
    password={password} setPassword={setPassword} name={authName} setName={setAuthName}
    busy={busy} message={message} onSubmit={authenticate} />;

  const nav = [
    { id: 'home', label: 'نمای کلی', icon: LayoutDashboard },
    { id: 'profile', label: 'پرونده من', icon: UserRound },
    { id: 'exam', label: 'آزمون تخصصی', icon: ClipboardList },
    ...(isAdmin ? [{ id: 'admin', label: 'مدیریت متقاضیان', icon: Users }] : [])
  ] as const;

  return <div dir="rtl" className="min-h-screen bg-[#f5f7f8] text-slate-900">
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <button onClick={() => setPage('home')} className="flex items-center gap-3 text-right">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-700 text-white"><Wrench size={21}/></span>
          <span><b className="block text-base">سرویس‌یاب</b><small className="text-xs text-slate-500">ره‌آورد الکترونیک</small></span>
        </button>
        <div className="hidden items-center gap-1 md:flex">
          {nav.map(n => <button key={n.id} onClick={() => setPage(n.id)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${page===n.id?'bg-teal-50 font-bold text-teal-800':'text-slate-600 hover:bg-slate-100'}`}><n.icon size={17}/>{n.label}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-36 truncate text-xs text-slate-500 sm:block">{profile.full_name || session.user.phone}</span>
          <button onClick={() => supabase.auth.signOut()} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="خروج"><LogOut size={18}/></button>
          <button onClick={() => setMenuOpen(v=>!v)} className="rounded-xl border border-slate-200 p-2 md:hidden"><Menu size={18}/></button>
        </div>
      </div>
      {menuOpen && <div className="grid gap-1 border-t p-3 md:hidden">{nav.map(n=><button key={n.id} onClick={()=>{setPage(n.id);setMenuOpen(false)}} className="flex items-center gap-2 rounded-xl p-3 text-right text-sm hover:bg-slate-50"><n.icon size={17}/>{n.label}</button>)}</div>}
    </header>
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {message && <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900"><span>{message}</span><button onClick={()=>setMessage('')}><X size={16}/></button></div>}
      {page === 'home' && <section className="space-y-7">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-teal-500/20 blur-3xl"/>
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-teal-100"><Activity size={14}/> شبکه تخصصی تعمیرات بردهای الکترونیکی</span>
            <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">مهارتت را به فرصت همکاری تبدیل کن</h1>
            <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-300 sm:text-base">سرویس‌یاب بستری برای ثبت اطلاعات تخصصی و ارزیابی اولیه متقاضیان همکاری با شبکه خدمات ره‌آورد الکترونیک است.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={()=>setPage('profile')} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400">تکمیل پرونده <ArrowLeft size={17}/></button>
              <button onClick={()=>setPage('exam')} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold hover:bg-white/10">مشاهده آزمون</button>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard icon={<UserRound/>} title="۱. تکمیل اطلاعات" text="اطلاعات فردی، تحصیلی و مهارت‌های تخصصی خود را ثبت کنید."/>
          <InfoCard icon={<BookOpen/>} title="۲. ارزیابی تخصصی" text="در صورت فعال بودن آزمون، به پرسش‌های چهارگزینه‌ای پاسخ دهید."/>
          <InfoCard icon={<ShieldCheck/>} title="۳. بررسی درخواست" text="پرونده شما توسط کارشناسان شرکت بررسی و وضعیت آن ثبت می‌شود."/>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-sm font-bold"><GraduationCap className="text-teal-700"/> وضعیت پرونده</div><p className="mt-3 text-2xl font-black">{statusLabels[profile.status || 'new']}</p><p className="mt-1 text-xs text-slate-500">وضعیت فعلی درخواست همکاری شما</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-sm font-bold"><Building2 className="text-teal-700"/> شبکه خدمات ره‌آورد الکترونیک</div><p className="mt-3 text-sm leading-7 text-slate-600">ثبت درخواست و شرکت در آزمون به‌منزله تأیید نهایی تخصص یا اعطای نمایندگی نیست.</p></div>
        </div>
      </section>}
      {page === 'profile' && <section className="mx-auto max-w-4xl">
        <PageHeading icon={<UserRound/>} title="پرونده تخصصی متقاضی" desc="اطلاعات فردی، آموزشی و مهارتی خود را تکمیل و ذخیره کنید."/>
        <form onSubmit={saveProfile} className="mt-6 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
          <FieldGroup title="اطلاعات فردی و تماس">
            <Field label="نام و نام خانوادگی" value={profile.full_name} onChange={v=>setProfile(p=>({...p,full_name:v}))} required/>
            <Field label="شماره تلفن همراه" value={profile.phone || session.user.phone} onChange={v=>setProfile(p=>({...p,phone:v}))} required/>
            <Field label="شهر محل سکونت یا فعالیت" value={profile.city} onChange={v=>setProfile(p=>({...p,city:v}))} required/>
          </FieldGroup>
          <FieldGroup title="اطلاعات آموزشی">
            <Field label="رشته یا زمینه آموزشی" value={profile.education_field} onChange={v=>setProfile(p=>({...p,education_field:v}))}/>
            <Field label="مقطع یا آخرین مدرک مرتبط" value={profile.education_level} onChange={v=>setProfile(p=>({...p,education_level:v}))}/>
            <Field label="مرکز آموزشی" value={profile.education_center} onChange={v=>setProfile(p=>({...p,education_center:v}))}/>
            <TextField label="دوره‌های تخصصی گذرانده‌شده" value={profile.completed_courses} onChange={v=>setProfile(p=>({...p,completed_courses:v}))}/>
          </FieldGroup>
          <FieldGroup title="اطلاعات تخصصی">
            <Field label="مهارت‌ها (با ویرگول جدا کنید)" value={(profile.skills||[]).join('، ')} onChange={v=>setProfile(p=>({...p,skills:v.split(/[،,]/).map(s=>s.trim()).filter(Boolean)}))} placeholder="عیب‌یابی، لحیم‌کاری، تعمیر برد"/>
            <Field label="سطح مهارت خوداظهاری" value={profile.self_assessed_level} onChange={v=>setProfile(p=>({...p,self_assessed_level:v}))} placeholder="مبتدی، متوسط، پیشرفته"/>
            <TextField label="سابقه فعالیت و تجربه تعمیرات" value={profile.experience} onChange={v=>setProfile(p=>({...p,experience:v}))}/>
            <TextField label="ابزارها و تجهیزات در اختیار" value={profile.equipment} onChange={v=>setProfile(p=>({...p,equipment:v}))}/>
          </FieldGroup>
          <TextField label="توضیحات تکمیلی" value={profile.notes} onChange={v=>setProfile(p=>({...p,notes:v}))}/>
          <div className="flex justify-end"><button disabled={busy} className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?'در حال ذخیره…':'ذخیره پرونده'}</button></div>
        </form>
      </section>}
      {page === 'exam' && <section className="mx-auto max-w-3xl">
        <PageHeading icon={<ClipboardList/>} title="آزمون تخصصی تعمیرات برد" desc="آزمون چهارگزینه‌ای برای ارزیابی اولیه دانش تخصصی متقاضیان."/>
        {!exam.length && !examResult && <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-start gap-4"><span className="rounded-2xl bg-teal-50 p-3 text-teal-800"><Clock3 size={25}/></span><div><h3 className="font-bold">پیش از شروع آزمون</h3><p className="mt-2 text-sm leading-7 text-slate-600">برای شروع آزمون باید نام و شهر در پرونده شما ثبت شده باشد. مدت و تعداد سؤالات توسط مدیریت سامانه تعیین می‌شود. پاسخ‌ها پس از ارسال نهایی قابل تغییر نیستند.</p></div></div>
          <button onClick={startExam} disabled={examBusy} className="mt-6 rounded-xl bg-teal-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">{examBusy?'در حال آماده‌سازی…':'شروع آزمون'}</button>
        </div>}
        {exam.length>0 && <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-teal-50 p-4 text-sm text-teal-900"><b>{exam.length} سؤال</b><span>پاسخ داده‌شده: {Object.keys(answers).length} از {exam.length}</span></div>
          {exam.map((q,i)=><article key={q.question_id} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-teal-700">سؤال {i+1}</p><h3 className="mt-2 font-bold leading-8">{q.prompt}</h3><div className="mt-4 grid gap-2">{q.options.map((option,index)=><label key={index} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${answers[q.question_id]===index?'border-teal-500 bg-teal-50':'border-slate-200 hover:bg-slate-50'}`}><input type="radio" name={q.question_id} checked={answers[q.question_id]===index} onChange={()=>setAnswers(a=>({...a,[q.question_id]:index}))}/>{option}</label>)}</div></article>)}
          <button onClick={submitExam} disabled={examBusy} className="w-full rounded-xl bg-teal-700 px-6 py-4 font-bold text-white disabled:opacity-50">{examBusy?'در حال ثبت…':'ثبت نهایی پاسخ‌ها'}</button>
        </div>}
        {examResult && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="text-emerald-700" size={30}/><h3 className="mt-3 text-lg font-black">آزمون ثبت شد</h3><p className="mt-2 text-sm text-slate-700">پاسخ‌های شما با موفقیت ثبت شده‌اند. نتیجه مطابق سیاست نمایش آزمون در پنل شما یا مدیریت قابل مشاهده خواهد بود.</p>{profile && <p className="mt-3 text-2xl font-black text-emerald-800">{Number(examResult.score).toFixed(1)}٪</p>}</div>}
      </section>}
      {page === 'admin' && isAdmin && <section>
        <div className="flex flex-wrap items-end justify-between gap-4"><PageHeading icon={<ShieldCheck/>} title="مدیریت متقاضیان" desc="بررسی پرونده‌ها، وضعیت درخواست و خروجی اطلاعات."/><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold"><Download size={17}/> دریافت CSV</button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="کل متقاضیان" value={applicants.length}/><Stat label="در حال بررسی" value={applicants.filter(p=>p.status==='reviewing').length}/><Stat label="تأیید اولیه" value={applicants.filter(p=>p.status==='pre_approved').length}/></div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={18} className="text-slate-400"/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="جست‌وجو بر اساس نام، شماره یا شهر…" className="w-full bg-transparent py-3 text-sm outline-none"/></div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">متقاضی</th><th className="p-4">شماره همراه</th><th className="p-4">شهر</th><th className="p-4">وضعیت</th><th className="p-4">تغییر وضعیت</th></tr></thead><tbody>{filteredApplicants.map(p=><tr key={p.user_id} className="border-t border-slate-100"><td className="p-4 font-bold">{p.full_name}</td><td className="p-4" dir="ltr">{p.phone}</td><td className="p-4">{p.city}</td><td className="p-4">{statusLabels[p.status]}</td><td className="p-4"><select value={p.status} onChange={e=>changeStatus(p.user_id,e.target.value as Profile['status'])} className="rounded-lg border border-slate-200 bg-white p-2"><option value="new">جدید</option><option value="reviewing">در حال بررسی</option><option value="pre_approved">تأیید اولیه</option><option value="rejected">رد شده</option></select></td></tr>)}</tbody></table>{!filteredApplicants.length&&<p className="p-8 text-center text-sm text-slate-500">متقاضی‌ای یافت نشد.</p>}</div>
          <h3 className="mt-8 font-bold">سوابق آزمون</h3><div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[520px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4 text-right">شناسه متقاضی</th><th className="p-4">وضعیت</th><th className="p-4">نمره</th><th className="p-4">تاریخ</th></tr></thead><tbody>{attempts.map(a=><tr key={a.id} className="border-t"><td className="p-4 font-mono text-xs">{a.applicant_id}</td><td className="p-4 text-center">{a.status}</td><td className="p-4 text-center">{a.score===null?'—':a.score+'٪'}</td><td className="p-4 text-center">{new Date(a.started_at).toLocaleDateString('fa-IR')}</td></tr>)}</tbody></table></div>
        </section>}
      </main>
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">سرویس‌یاب · شرکت ره‌آورد الکترونیک</footer>
  </div>;
}

function SetupScreen(){return <div dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8"><ShieldCheck className="text-amber-600" size={34}/><h1 className="mt-4 text-xl font-black">تنظیمات اتصال سرویس‌یاب</h1><p className="mt-3 text-sm leading-8 text-slate-600">برای اجرای برنامه، متغیرهای VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY را در محیط استقرار تنظیم کنید. از کلید service_role در مرورگر استفاده نکنید.</p></div></div>}
function AuthScreen(p:any){return <div dir="rtl" className="grid min-h-screen bg-[#f5f7f8] lg:grid-cols-2"><div className="hidden flex-col justify-between bg-slate-950 p-12 text-white lg:flex"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-500 text-slate-950"><Wrench/></span><b>سرویس‌یاب</b></div><div><p className="text-sm text-teal-300">ره‌آورد الکترونیک</p><h1 className="mt-4 text-5xl font-black leading-tight">شبکه تخصصی<br/>تعمیرات بردهای الکترونیکی</h1><p className="mt-5 max-w-md text-sm leading-8 text-slate-300">برای آغاز فرایند همکاری، حساب کاربری ایجاد کنید و اطلاعات تخصصی خود را ثبت نمایید.</p></div><small className="text-slate-500">سامانه ارزیابی اولیه متقاضیان همکاری</small></div><div className="grid place-items-center p-5"><form onSubmit={p.onSubmit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"><div className="mb-7 lg:hidden"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-white"><Wrench/></span><h1 className="mt-3 text-2xl font-black">سرویس‌یاب</h1><p className="mt-1 text-xs text-slate-500">ره‌آورد الکترونیک</p></div><h2 className="text-2xl font-black">{p.mode==='signup'?'ایجاد حساب متقاضی':'ورود به حساب کاربری'}</h2><p className="mt-2 text-sm text-slate-500">برای ادامه شماره همراه و رمز عبور خود را وارد کنید.</p>{p.mode==='signup'&&<div className="mt-5"><label className={labelClass}>نام و نام خانوادگی</label><input required value={p.name} onChange={e=>p.setName(e.target.value)} className={inputClass}/></div>}<div className="mt-5"><label className={labelClass}>شماره تلفن همراه</label><input required dir="ltr" value={p.phone} onChange={e=>p.setPhone(e.target.value)} placeholder="+98912..." className={inputClass}/></div><div className="mt-4"><label className={labelClass}>رمز عبور (حداقل ۸ کاراکتر)</label><input required minLength={8} type="password" value={p.password} onChange={e=>p.setPassword(e.target.value)} className={inputClass}/></div>{p.message&&<p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700">{p.message}</p>}<button disabled={p.busy} className="mt-6 w-full rounded-xl bg-teal-700 py-3.5 text-sm font-bold text-white disabled:opacity-50">{p.busy?'لطفاً صبر کنید…':p.mode==='signup'?'ثبت‌نام':'ورود'}</button><button type="button" onClick={()=>{p.setMode(p.mode==='signup'?'login':'signup');}} className="mt-4 w-full text-sm font-semibold text-teal-800">{p.mode==='signup'?'قبلاً حساب ساخته‌اید؟ ورود':'حساب ندارید؟ ثبت‌نام'}</button></form></div></div>}
function InfoCard(p:any){return <div className="rounded-2xl border border-slate-200 bg-white p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800">{p.icon}</span><h3 className="mt-4 font-bold">{p.title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{p.text}</p></div>}
function PageHeading(p:any){return <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-100 text-teal-800">{p.icon}</span><div><h1 className="text-xl font-black sm:text-2xl">{p.title}</h1><p className="mt-1 text-sm text-slate-500">{p.desc}</p></div></div>}
function FieldGroup(p:any){return <fieldset><legend className="mb-4 border-b border-slate-100 pb-3 text-base font-black">{p.title}</legend><div className="grid gap-4 sm:grid-cols-2">{p.children}</div></fieldset>}
function Field(p:any){return <div><label className={labelClass}>{p.label}</label><input required={p.required} value={p.value||''} onChange={e=>p.onChange(e.target.value)} placeholder={p.placeholder||''} className={inputClass}/></div>}
function TextField(p:any){return <div className="sm:col-span-2"><label className={labelClass}>{p.label}</label><textarea rows={3} value={p.value||''} onChange={e=>p.onChange(e.target.value)} className={inputClass}/></div>}
function Stat(p:any){return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{p.label}</p><b className="mt-2 block text-3xl">{p.value}</b></div>}
export default App;
