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
type Attempt = { id: string; applicant_id: string; started_at: string; submitted_at: string | null; score: number | null; status: string; total_questions: number };

const emptyProfile: Partial<Profile> = {
  full_name: '', phone: '', city: '', education_field: '', education_level: '',
  education_center: '', completed_courses: '', skills: [], self_assessed_level: '',
  experience: '', equipment: '', notes: ''
};
const statusLabels: Record<string, string> = {
  new: 'جدید', reviewing: 'در حال بررسی', pre_approved: 'تأیید اولیه', rejected: 'رد شده'
};
function normalizePhone(value: string) {
  const digits = value.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[\s()-]/g, '');
  if (/^09\d{9}$/.test(digits)) return '+98' + digits.slice(1);
  if (/^9\d{9}$/.test(digits)) return '+98' + digits;
  return digits;
}
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10';
const labelClass = 'mb-2 block text-sm font-semibold text-slate-700';

function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [showAuth, setShowAuth] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [needsOtp, setNeedsOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState<'home' | 'profile' | 'exam' | 'admin'>('home');
  const [profile, setProfile] = useState<Partial<Profile>>(emptyProfile);
  const [isAdmin, setIsAdmin] = useState(false);
  const [applicants, setApplicants] = useState<Profile[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [examConfig, setExamConfig] = useState({ is_active: false, duration_minutes: 30, question_count: 20, max_attempts: 1, show_score_to_applicant: false });
  const [bankCount, setBankCount] = useState(0);
  const [questionRows, setQuestionRows] = useState<any[]>([]);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionDraft, setQuestionDraft] = useState({ prompt: '', options: ['', '', '', ''], correct_option: 0 });
  const [selectedApplicant, setSelectedApplicant] = useState<Profile | null>(null);
  const [filter, setFilter] = useState('');
  const [exam, setExam] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState('');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [examExpiry, setExamExpiry] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [examResult, setExamResult] = useState<any>(null);
  const [showExamScore, setShowExamScore] = useState(false);
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
      supabase.from('applicant_profiles').select('user_id,full_name,phone,city,education_field,education_level,education_center,completed_courses,skills,self_assessed_level,experience,equipment,notes,status,created_at,updated_at').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle()
    ]);
    setIsAdmin(!!role);
    if (row) setProfile(row as Profile);
    else setProfile({ ...emptyProfile, user_id: userId, phone: session?.user?.phone ?? '', full_name: session?.user?.user_metadata?.full_name ?? '' });
  }

  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const normalized = normalizePhone(phone);
      if (!normalized || password.length < 8) throw new Error('شماره همراه و رمز عبور حداقل ۸ کاراکتری را وارد کنید.');
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          phone: normalized, password,
          options: { data: { full_name: authName.trim() } }
        });
        if (error) throw error;
        if (data.session) setMessage('حساب شما ایجاد شد.');
        else { setNeedsOtp(true); setMessage('کد تأیید به شماره همراه شما ارسال شد. کد را وارد کنید.'); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ phone: normalized, password });
        if (error) throw error;
      }
    } catch (err) { setMessage(err instanceof Error ? err.message : 'خطا در احراز هویت'); }
    finally { setBusy(false); }
  }

  async function verifySignupOtp(e: React.FormEvent) { e.preventDefault(); setBusy(true); setMessage(''); try { const { error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token: otpCode.trim(), type: 'sms' }); if (error) throw error; setNeedsOtp(false); setMessage('شماره همراه تأیید شد.'); } catch (err) { setMessage(err instanceof Error ? err.message : 'کد تأیید معتبر نیست.'); } finally { setBusy(false); } }

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
      const { data: existingProfile, error: lookupError } = await supabase.from('applicant_profiles').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (lookupError) throw lookupError;
      const { error } = existingProfile
        ? await supabase.from('applicant_profiles').update({
            full_name: payload.full_name, phone: payload.phone, city: payload.city,
            education_field: payload.education_field, education_level: payload.education_level,
            education_center: payload.education_center, completed_courses: payload.completed_courses,
            skills: payload.skills, self_assessed_level: payload.self_assessed_level,
            experience: payload.experience, equipment: payload.equipment, notes: payload.notes
          }).eq('user_id', session.user.id)
        : await supabase.from('applicant_profiles').insert(payload);
      if (error) throw error;
      setProfile({ ...payload, status: profile.status || 'new' });
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
      setRemainingSeconds(Math.max(0, Math.floor((Date.parse(rows[0].expires_at) - Date.now()) / 1000)));
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
      const result = Array.isArray(data) ? data[0] : data;
      const { data: examSettings } = await supabase.from('exam_settings').select('show_score_to_applicant').eq('id', true).maybeSingle();
      setShowExamScore(!!examSettings?.show_score_to_applicant);
      setExamResult(result);
      setExam([]);
      setMessage('پاسخ‌های شما با موفقیت ثبت شد.');
      await loadAdminData();
    } catch (err) { setMessage(err instanceof Error ? err.message : 'ثبت آزمون ناموفق بود.'); }
    finally { setExamBusy(false); }
  }

  useEffect(() => {
    if (!examExpiry || exam.length === 0) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.parse(examExpiry) - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) {
        window.clearInterval(timer);
        void submitExam();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examExpiry, exam.length, attemptId, answers]);

  async function loadAdminData() {
    if (!isAdmin) return;
    const [{ data: people, error: peopleError }, { data: results, error: resultsError }, { data: settings }, { count }, { data: questions }, { data: keys }] = await Promise.all([
      supabase.from('applicant_profiles').select('user_id,full_name,phone,city,education_field,education_level,education_center,completed_courses,skills,self_assessed_level,experience,equipment,notes,status,created_at,updated_at').order('created_at', { ascending: false }),
      supabase.rpc('admin_list_exam_attempts'),
      supabase.from('exam_settings').select('*').eq('id', true).maybeSingle(),
      supabase.from('exam_questions').select('id', { count: 'exact', head: true }),
      supabase.from('exam_questions').select('id,prompt,options,is_active,sort_order').order('sort_order'),
      supabase.from('exam_answer_keys').select('question_id,correct_option')
    ]);
    if (peopleError || resultsError) { setMessage(peopleError?.message || resultsError?.message || 'خطا در دریافت اطلاعات'); return; }
    setApplicants((people || []) as Profile[]);
    setAttempts((results || []) as Attempt[]);
    if (settings) setExamConfig({ is_active: settings.is_active, duration_minutes: settings.duration_minutes, question_count: settings.question_count, max_attempts: settings.max_attempts, show_score_to_applicant: settings.show_score_to_applicant });
    setBankCount(count || 0);
    setQuestionRows((questions || []).map(q => ({ ...q, correct_option: (keys || []).find(k => k.question_id === q.id)?.correct_option ?? 0 })));
  }

  async function saveExamConfig() {
    if (examConfig.is_active && bankCount < examConfig.question_count) { setMessage('برای فعال‌سازی آزمون باید حداقل به تعداد سؤالات انتخاب‌شده، سؤال فعال در بانک داشته باشید.'); return; }
    const { error } = await supabase.from('exam_settings').update(examConfig).eq('id', true);
    setMessage(error ? error.message : 'تنظیمات آزمون ذخیره شد.');
  }

  async function createQuestion(e: React.FormEvent) {
    e.preventDefault();
    const { error } = editingQuestionId
      ? await supabase.rpc('admin_update_exam_question', {
          p_question_id: editingQuestionId,
          p_prompt: questionDraft.prompt,
          p_options: questionDraft.options,
          p_correct_option: questionDraft.correct_option,
          p_is_active: true
        })
      : await supabase.rpc('admin_create_exam_question', {
          p_prompt: questionDraft.prompt,
          p_options: questionDraft.options,
          p_correct_option: questionDraft.correct_option,
          p_is_active: true
        });
    if (error) setMessage(error.message);
    else {
      setQuestionDraft({ prompt: '', options: ['', '', '', ''], correct_option: 0 });
      setEditingQuestionId(null);
      setMessage('سؤال و کلید پاسخ با موفقیت ذخیره شد.');
      await loadAdminData();
    }
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
  if (!session) return showAuth ? <AuthScreen onBack={() => setShowAuth(false)} mode={authMode} setMode={setAuthMode} phone={phone} setPhone={setPhone}
    password={password} setPassword={setPassword} name={authName} setName={setAuthName}
    needsOtp={needsOtp} otpCode={otpCode} setOtpCode={setOtpCode} onVerifyOtp={verifySignupOtp}
    busy={busy} message={message} onSubmit={authenticate} /> : <PublicLanding onSignup={() => { setAuthMode('signup'); setShowAuth(true); }} onLogin={() => { setAuthMode('login'); setShowAuth(true); }} />;

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
          {nav.map(n => <button key={n.id} onClick={() => setPage(n.id as 'home' | 'profile' | 'exam' | 'admin')} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${page===n.id?'bg-teal-50 font-bold text-teal-800':'text-slate-600 hover:bg-slate-100'}`}><n.icon size={17}/>{n.label}</button>)}
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
          <div className="flex items-center justify-between rounded-xl bg-teal-50 p-4 text-sm text-teal-900"><b>{exam.length} سؤال</b><span>زمان باقی‌مانده: {Math.floor(remainingSeconds/60).toString().padStart(2,'0')}:{(remainingSeconds%60).toString().padStart(2,'0')}</span><span>پاسخ: {Object.keys(answers).length}/{exam.length}</span></div>
          {exam.map((q,i)=><article key={q.question_id} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-teal-700">سؤال {i+1}</p><h3 className="mt-2 font-bold leading-8">{q.prompt}</h3><div className="mt-4 grid gap-2">{q.options.map((option,index)=><label key={index} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${answers[q.question_id]===index?'border-teal-500 bg-teal-50':'border-slate-200 hover:bg-slate-50'}`}><input type="radio" name={q.question_id} checked={answers[q.question_id]===index} onChange={()=>setAnswers(a=>({...a,[q.question_id]:index}))}/>{option}</label>)}</div></article>)}
          <button onClick={submitExam} disabled={examBusy} className="w-full rounded-xl bg-teal-700 px-6 py-4 font-bold text-white disabled:opacity-50">{examBusy?'در حال ثبت…':'ثبت نهایی پاسخ‌ها'}</button>
        </div>}
        {examResult && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><CheckCircle2 className="text-emerald-700" size={30}/><h3 className="mt-3 text-lg font-black">آزمون ثبت شد</h3><p className="mt-2 text-sm text-slate-700">پاسخ‌های شما با موفقیت ثبت شده‌اند. نتیجه مطابق سیاست نمایش آزمون در پنل شما یا مدیریت قابل مشاهده خواهد بود.</p>{showExamScore && <p className="mt-3 text-2xl font-black text-emerald-800">{Number(examResult.score).toFixed(1)}٪</p>}</div>}
      </section>}
      {page === 'admin' && isAdmin && <section>
        <div className="flex flex-wrap items-end justify-between gap-4"><PageHeading icon={<ShieldCheck/>} title="مدیریت متقاضیان" desc="بررسی پرونده‌ها، وضعیت درخواست و خروجی اطلاعات."/><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold"><Download size={17}/> دریافت CSV</button></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="کل متقاضیان" value={applicants.length}/><Stat label="در حال بررسی" value={applicants.filter(p=>p.status==='reviewing').length}/><Stat label="تأیید اولیه" value={applicants.filter(p=>p.status==='pre_approved').length}/></div>
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={18} className="text-slate-400"/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="جست‌وجو بر اساس نام، شماره یا شهر…" className="w-full bg-transparent py-3 text-sm outline-none"/></div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4">متقاضی</th><th className="p-4">شماره همراه</th><th className="p-4">شهر</th><th className="p-4">وضعیت</th><th className="p-4">تغییر وضعیت</th></tr></thead><tbody>{filteredApplicants.map(p=><tr key={p.user_id} className="border-t border-slate-100"><td className="p-4"><button onClick={()=>setSelectedApplicant(p)} className="font-bold text-teal-800 underline decoration-dotted">{p.full_name}</button></td><td className="p-4" dir="ltr">{p.phone}</td><td className="p-4">{p.city}</td><td className="p-4">{statusLabels[p.status]}</td><td className="p-4"><select value={p.status} onChange={e=>changeStatus(p.user_id,e.target.value as Profile['status'])} className="rounded-lg border border-slate-200 bg-white p-2"><option value="new">جدید</option><option value="reviewing">در حال بررسی</option><option value="pre_approved">تأیید اولیه</option><option value="rejected">رد شده</option></select></td></tr>)}</tbody></table>{!filteredApplicants.length&&<p className="p-8 text-center text-sm text-slate-500">متقاضی‌ای یافت نشد.</p>}</div>
          {selectedApplicant && <div className="mt-6 rounded-2xl border border-teal-200 bg-teal-50/60 p-5"><div className="flex items-center justify-between"><h3 className="font-black">پرونده متقاضی: {selectedApplicant.full_name}</h3><button onClick={()=>setSelectedApplicant(null)}><X size={18}/></button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p>شماره تماس: {selectedApplicant.phone}</p><p>شهر: {selectedApplicant.city}</p><p>رشته تحصیلی: {selectedApplicant.education_field}</p><p>مقطع: {selectedApplicant.education_level}</p><p>مرکز آموزشی: {selectedApplicant.education_center}</p><p>دوره‌ها: {selectedApplicant.completed_courses}</p><p>مهارت‌ها: {(selectedApplicant.skills||[]).join('، ')}</p><p>سطح خوداظهاری: {selectedApplicant.self_assessed_level}</p><p className="sm:col-span-2">سابقه: {selectedApplicant.experience}</p><p className="sm:col-span-2">تجهیزات: {selectedApplicant.equipment}</p><p className="sm:col-span-2">توضیحات: {selectedApplicant.notes}</p></div></div>}
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <form onSubmit={createQuestion} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between"><h3 className="font-black">افزودن سؤال آزمون</h3><span className="text-xs text-slate-500">{bankCount} از ۵۰ سؤال</span></div>
              <textarea required minLength={3} value={questionDraft.prompt} onChange={e=>setQuestionDraft(q=>({...q,prompt:e.target.value}))} placeholder="متن سؤال تخصصی…" className={inputClass+' mt-4'} rows={3}/>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{questionDraft.options.map((option,i)=><input key={i} required value={option} onChange={e=>setQuestionDraft(q=>({...q,options:q.options.map((v,j)=>j===i?e.target.value:v)}))} placeholder={'گزینه '+(i+1)} className={inputClass}/>)}</div>
              <label className="mt-4 block text-xs font-bold">پاسخ صحیح</label><select value={questionDraft.correct_option} onChange={e=>setQuestionDraft(q=>({...q,correct_option:Number(e.target.value)}))} className={inputClass+' mt-2'}>{[0,1,2,3].map(i=><option key={i} value={i}>گزینه {i+1}</option>)}</select>
              <div className="mt-4 flex gap-2"><button disabled={!editingQuestionId && bankCount>=50} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-40">{editingQuestionId?'ذخیره ویرایش':'ثبت سؤال'}</button>{editingQuestionId&&<button type="button" onClick={()=>{setEditingQuestionId(null);setQuestionDraft({prompt:'',options:['','','',''],correct_option:0})}} className="rounded-xl border px-4 py-3 text-sm">انصراف</button>}</div>
            </form>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">بانک سؤالات ({bankCount}/۵۰)</h3><div className="mt-3 max-h-72 space-y-2 overflow-auto">{questionRows.map((q,i)=><div key={q.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{i+1}. {q.prompt}</p><p className="mt-1 text-xs text-slate-500">{q.is_active?'فعال':'غیرفعال'}</p></div><div className="flex shrink-0 gap-2"><button type="button" onClick={()=>{setEditingQuestionId(q.id);setQuestionDraft({prompt:q.prompt,options:q.options,correct_option:q.correct_option})}} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold">ویرایش</button><button type="button" onClick={async()=>{const {error}=await supabase.rpc('admin_update_exam_question',{p_question_id:q.id,p_prompt:q.prompt,p_options:q.options,p_correct_option:q.correct_option,p_is_active:!q.is_active});if(error)setMessage(error.message);else await loadAdminData()}} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">{q.is_active?'غیرفعال‌سازی':'فعال‌سازی'}</button></div></div>)}{!questionRows.length&&<p className="text-sm text-slate-500">هنوز سؤالی ثبت نشده است.</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">تنظیمات آزمون</h3>
              <label className="mt-4 flex items-center justify-between text-sm"><span>فعال‌سازی آزمون</span><input type="checkbox" checked={examConfig.is_active} onChange={e=>setExamConfig(s=>({...s,is_active:e.target.checked}))}/></label>
              <label className="mt-4 block text-sm">مدت آزمون (دقیقه)<input type="number" min="1" max="240" value={examConfig.duration_minutes} onChange={e=>setExamConfig(s=>({...s,duration_minutes:Number(e.target.value)}))} className={inputClass+' mt-2'}/></label>
              <label className="mt-4 block text-sm">تعداد سؤال در هر آزمون<input type="number" min="1" max={Math.max(1,bankCount)} value={examConfig.question_count} onChange={e=>setExamConfig(s=>({...s,question_count:Number(e.target.value)}))} className={inputClass+' mt-2'}/></label>
              <label className="mt-4 block text-sm">دفعات مجاز شرکت<input type="number" min="1" max="10" value={examConfig.max_attempts} onChange={e=>setExamConfig(s=>({...s,max_attempts:Number(e.target.value)}))} className={inputClass+' mt-2'}/></label>
              <label className="mt-4 flex items-center justify-between text-sm"><span>نمایش نمره به متقاضی</span><input type="checkbox" checked={examConfig.show_score_to_applicant} onChange={e=>setExamConfig(s=>({...s,show_score_to_applicant:e.target.checked}))}/></label>
              <button onClick={saveExamConfig} className="mt-5 rounded-xl border border-teal-700 px-5 py-3 text-sm font-bold text-teal-800">ذخیره تنظیمات</button>
            </div>
          </div>
          <h3 className="mt-8 font-bold">سوابق آزمون</h3><div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[520px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-4 text-right">شناسه متقاضی</th><th className="p-4">وضعیت</th><th className="p-4">نمره</th><th className="p-4">تاریخ</th></tr></thead><tbody>{attempts.map(a=><tr key={a.id} className="border-t"><td className="p-4 font-mono text-xs">{a.applicant_id}</td><td className="p-4 text-center">{a.status}</td><td className="p-4 text-center">{a.score===null?'—':a.score+'٪'}</td><td className="p-4 text-center">{new Date(a.started_at).toLocaleDateString('fa-IR')}</td></tr>)}</tbody></table></div>
        </section>}
      </main>
    <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">سرویس‌یاب · شرکت ره‌آورد الکترونیک</footer>
  </div>;
}

function PublicLanding(p:any){return <div dir="rtl" className="min-h-screen bg-white text-slate-900"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white"><Wrench/></span><div><b className="block">سرویس‌یاب</b><small className="text-xs text-slate-500">ره‌آورد الکترونیک</small></div></div><div className="flex gap-2"><button onClick={p.onLogin} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-700">ورود</button><button onClick={p.onSignup} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white">ثبت‌نام متقاضی</button></div></header><main><section className="bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-2 lg:py-28"><div><span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-2 text-xs text-teal-200">شبکه تخصصی تعمیرات بردهای الکترونیکی</span><h1 className="mt-7 text-4xl font-black leading-[1.5] sm:text-6xl">مهارت فنی شما، آغاز یک همکاری تخصصی</h1><p className="mt-5 max-w-xl text-sm leading-8 text-slate-300">سرویس‌یاب بستری برای شناسایی، ثبت اطلاعات و ارزیابی اولیه متخصصان و متقاضیان همکاری با شبکه خدمات ره‌آورد الکترونیک است.</p><button onClick={p.onSignup} className="mt-8 inline-flex items-center gap-3 rounded-xl bg-teal-500 px-6 py-4 text-sm font-black text-slate-950">شروع ثبت‌نام <ChevronLeft size={18}/></button></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-3xl border border-white/10 bg-white/5 p-7"><GraduationCap className="text-teal-300" size={30}/><b className="mt-5 block text-lg">ارزیابی تخصصی</b><p className="mt-2 text-sm leading-7 text-slate-400">ثبت سوابق آموزشی و مهارتی و شرکت در آزمون چهارگزینه‌ای.</p></div><div className="mt-0 rounded-3xl border border-white/10 bg-white/5 p-7 sm:mt-10"><Users className="text-teal-300" size={30}/><b className="mt-5 block text-lg">بررسی درخواست</b><p className="mt-2 text-sm leading-7 text-slate-400">بررسی پرونده متقاضی توسط کارشناسان شرکت.</p></div></div></div></section><section className="mx-auto max-w-7xl px-5 py-16"><div className="text-center"><p className="text-xs font-bold text-teal-700">فرایند همکاری</p><h2 className="mt-3 text-3xl font-black">از ثبت‌نام تا ارزیابی اولیه</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3"><InfoCard icon={<UserRound/>} title="۱. ایجاد حساب و تکمیل پرونده" text="اطلاعات فردی، شهر، سوابق آموزشی و توانمندی‌های تخصصی خود را ثبت کنید."/><InfoCard icon={<ClipboardList/>} title="۲. شرکت در آزمون آنلاین" text="در صورت فعال بودن آزمون، دانش تخصصی خود را در پرسش‌های چهارگزینه‌ای ارزیابی کنید."/><InfoCard icon={<ShieldCheck/>} title="۳. بررسی توسط شرکت" text="کارشناسان ره‌آورد الکترونیک اطلاعات و نتیجه ارزیابی اولیه را بررسی می‌کنند."/></div></section><section className="border-t border-slate-100 bg-slate-50 py-14"><div className="mx-auto max-w-4xl px-5"><h2 className="text-2xl font-black">سؤالات متداول</h2><div className="mt-6 grid gap-4"><Faq q="ثبت‌نام به معنی دریافت نمایندگی است؟" a="خیر. ثبت‌نام و آزمون صرفاً بخشی از فرایند ارزیابی اولیه هستند و به معنی تأیید قطعی تخصص یا اعطای نمایندگی نیستند."/><Faq q="برای ثبت‌نام چه اطلاعاتی لازم است؟" a="اطلاعات تماس و شهر، سوابق آموزشی، مهارت‌ها، تجربه تعمیرات و تجهیزات تخصصی در اختیار."/><Faq q="آزمون چه زمانی در دسترس است؟" a="آزمون پس از فعال‌سازی توسط مدیریت سامانه و تکمیل اطلاعات اولیه پرونده قابل شروع خواهد بود."/><Faq q="چگونه از وضعیت درخواست مطلع شوم؟" a="پس از ورود به حساب کاربری، وضعیت فعلی پرونده در پنل متقاضی نمایش داده می‌شود."/></div></div></section></main><footer className="bg-slate-950 px-5 py-8 text-center text-xs text-slate-400">سرویس‌یاب · شرکت ره‌آورد الکترونیک</footer></div>}
function Faq(p:any){return <details className="rounded-xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-bold">{p.q}</summary><p className="mt-3 text-sm leading-7 text-slate-600">{p.a}</p></details>}
function SetupScreen(){return <div dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8"><ShieldCheck className="text-amber-600" size={34}/><h1 className="mt-4 text-xl font-black">تنظیمات اتصال سرویس‌یاب</h1><p className="mt-3 text-sm leading-8 text-slate-600">برای اجرای برنامه، متغیرهای VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY را در محیط استقرار تنظیم کنید. از کلید service_role در مرورگر استفاده نکنید.</p></div></div>}
function AuthScreen(p:any){return <div dir="rtl" className="grid min-h-screen bg-[#f5f7f8] lg:grid-cols-2"><div className="hidden flex-col justify-between bg-slate-950 p-12 text-white lg:flex"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-500 text-slate-950"><Wrench/></span><b>سرویس‌یاب</b></div><div><p className="text-sm text-teal-300">ره‌آورد الکترونیک</p><h1 className="mt-4 text-5xl font-black leading-tight">شبکه تخصصی<br/>تعمیرات بردهای الکترونیکی</h1><p className="mt-5 max-w-md text-sm leading-8 text-slate-300">برای آغاز فرایند همکاری، حساب کاربری ایجاد کنید و اطلاعات تخصصی خود را ثبت نمایید.</p></div><small className="text-slate-500">سامانه ارزیابی اولیه متقاضیان همکاری</small></div><div className="grid place-items-center p-5"><form onSubmit={p.onSubmit} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9"><div className="mb-7 lg:hidden"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-700 text-white"><Wrench/></span><h1 className="mt-3 text-2xl font-black">سرویس‌یاب</h1><p className="mt-1 text-xs text-slate-500">ره‌آورد الکترونیک</p></div><button type="button" onClick={p.onBack} className="mb-5 text-xs font-semibold text-teal-800">← بازگشت به صفحه اصلی</button><h2 className="text-2xl font-black">{p.mode==='signup'?'ایجاد حساب متقاضی':'ورود به حساب کاربری'}</h2><p className="mt-2 text-sm text-slate-500">برای ادامه شماره همراه و رمز عبور خود را وارد کنید.</p>{p.mode==='signup'&&<div className="mt-5"><label className={labelClass}>نام و نام خانوادگی</label><input required value={p.name} onChange={e=>p.setName(e.target.value)} className={inputClass}/></div>}<div className="mt-5"><label className={labelClass}>شماره تلفن همراه</label><input required dir="ltr" value={p.phone} onChange={e=>p.setPhone(e.target.value)} placeholder="+98912..." className={inputClass}/></div>{!p.needsOtp&&<div className="mt-4"><label className={labelClass}>رمز عبور (حداقل ۸ کاراکتر)</label><input required minLength={8} type="password" value={p.password} onChange={e=>p.setPassword(e.target.value)} className={inputClass}/></div>}{p.needsOtp&&<div className="mt-4"><label className={labelClass}>کد تأیید پیامکی</label><input required inputMode="numeric" dir="ltr" value={p.otpCode} onChange={e=>p.setOtpCode(e.target.value)} className={inputClass}/></div>}{p.message&&<p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700">{p.message}</p>}<button disabled={p.busy} onClick={p.needsOtp?p.onVerifyOtp:undefined} type={p.needsOtp?'button':'submit'} className="mt-6 w-full rounded-xl bg-teal-700 py-3.5 text-sm font-bold text-white disabled:opacity-50">{p.busy?'لطفاً صبر کنید…':p.needsOtp?'تأیید شماره همراه':p.mode==='signup'?'ثبت‌نام':'ورود'}</button>{!p.needsOtp&&<button type="button" onClick={()=>{p.setMode(p.mode==='signup'?'login':'signup');}} className="mt-4 w-full text-sm font-semibold text-teal-800">{p.mode==='signup'?'قبلاً حساب ساخته‌اید؟ ورود':'حساب ندارید؟ ثبت‌نام'}</button>}</form></div></div>}
function InfoCard(p:any){return <div className="rounded-2xl border border-slate-200 bg-white p-5"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-50 text-teal-800">{p.icon}</span><h3 className="mt-4 font-bold">{p.title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{p.text}</p></div>}
function PageHeading(p:any){return <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-100 text-teal-800">{p.icon}</span><div><h1 className="text-xl font-black sm:text-2xl">{p.title}</h1><p className="mt-1 text-sm text-slate-500">{p.desc}</p></div></div>}
function FieldGroup(p:any){return <fieldset><legend className="mb-4 border-b border-slate-100 pb-3 text-base font-black">{p.title}</legend><div className="grid gap-4 sm:grid-cols-2">{p.children}</div></fieldset>}
function Field(p:any){return <div><label className={labelClass}>{p.label}</label><input required={p.required} value={p.value||''} onChange={e=>p.onChange(e.target.value)} placeholder={p.placeholder||''} className={inputClass}/></div>}
function TextField(p:any){return <div className="sm:col-span-2"><label className={labelClass}>{p.label}</label><textarea rows={3} value={p.value||''} onChange={e=>p.onChange(e.target.value)} className={inputClass}/></div>}
function Stat(p:any){return <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{p.label}</p><b className="mt-2 block text-3xl">{p.value}</b></div>}
export default App;
