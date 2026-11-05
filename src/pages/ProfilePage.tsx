import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, GraduationCap, Loader2, Phone,
  Save, User, Wrench, FileText,
} from 'lucide-react';
import { useProfileStore } from '@/store/profileStore';
import { useAppStore } from '@/store/appStore';
import { useAuthStore } from '@/store/authStore';
import type { ApplicantProfile } from '@/lib/api';
import { PROVINCES } from '@/data/dataSources';

// سطوح مهارت خوداظهاری — ماده ۵-۴ بخش ج
const SKILL_LEVELS = ['مبتدی', 'متوسط', 'پیشرفته', 'متخصص'];

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  textarea?: boolean;
  rows?: number;
  hint?: string;
}

function Field({ label, value, onChange, placeholder, required, textarea, rows = 4, hint }: FieldProps) {
  const base = textarea
    ? 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink-800 focus-ring resize-none'
    : 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink-800 focus-ring';
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={base}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
      {hint && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
    </label>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: typeof User; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary-600" />
      </div>
      <div>
        <h2 className="font-bold text-ink-900">{title}</h2>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const setPage = useAppStore((s) => s.setPage);
  const showToast = useAppStore((s) => s.showToast);
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const loading = useProfileStore((s) => s.loading);
  const saving = useProfileStore((s) => s.saving);
  const loadProfile = useProfileStore((s) => s.loadProfile);
  const saveProfile = useProfileStore((s) => s.saveProfile);

  const [form, setForm] = useState<Partial<ApplicantProfile>>({});
  const [dirty, setDirty] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const set = (key: keyof ApplicantProfile) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
    setDirty(true);
  };

  const requiredOk = useMemo(() => {
    return !!(form.city?.trim() && form.education_field?.trim() && form.education_degree?.trim()
      && form.skill_areas?.trim() && form.skill_level?.trim());
  }, [form]);

  const submit = async () => {
    if (!requiredOk) {
      showToast('لطفاً فیلدهای ستاره‌دار را تکمیل کنید');
      return;
    }
    try {
      const complete = await saveProfile({
        city: form.city ?? '',
        contact_extra: form.contact_extra ?? '',
        education_field: form.education_field ?? '',
        education_degree: form.education_degree ?? '',
        education_center: form.education_center ?? '',
        courses: form.courses ?? '',
        skill_areas: form.skill_areas ?? '',
        skill_level: form.skill_level ?? '',
        experience: form.experience ?? '',
        tools: form.tools ?? '',
        description: form.description ?? '',
      });
      setDirty(false);
      setSavedOnce(true);
      showToast(complete ? 'اطلاعات با موفقیت ذخیره شد' : 'ذخیره شد؛ برای شرکت در آزمون فیلدهای ستاره‌دار را کامل کنید');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'خطا در ذخیره اطلاعات');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">اطلاعات متقاضی</h1>
        <p className="text-sm text-ink-500 mt-1">
          این اطلاعات پرونده همکاری شما را تشکیل می‌دهد و فقط توسط شرکت قابل مشاهده است.
        </p>
      </div>

      {savedOnce && !dirty && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>اطلاعات شما ذخیره شده است. می‌توانید هر زمان ویرایش کنید.</span>
        </div>
      )}

      {/* الف) اطلاعات فردی و تماس */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <SectionTitle icon={User} title="اطلاعات فردی و تماس" subtitle="گروه الف — ماده ۵-۴ قرارداد" />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">نام و نام خانوادگی</span>
          <input
            type="text"
            value={user?.full_name ?? ''}
            disabled
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-ink-500"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">شماره تلفن همراه</span>
          <div className="relative">
            <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-300" />
            <input
              type="text"
              value={user?.phone ?? ''}
              disabled
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm text-ink-500 text-left"
            />
          </div>
        </label>
        <Field
          label="شهر محل سکونت یا فعالیت"
          required
          value={form.city ?? ''}
          onChange={set('city')}
          placeholder="مثلاً تهران"
          hint="برای انتخاب، یکی از شهرهای فهرست را تایپ کنید"
        />
        <Field
          label="اطلاعات تماس تکمیلی (اختیاری)"
          value={form.contact_extra ?? ''}
          onChange={set('contact_extra')}
          placeholder="مثلاً تلگرام، ایمیل یا تلفن ثابت"
        />
      </div>

      {/* ب) اطلاعات آموزشی */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <SectionTitle icon={GraduationCap} title="اطلاعات آموزشی" subtitle="گروه ب — ماده ۵-۴ قرارداد" />
        <Field
          label="رشته تحصیلی یا زمینه آموزشی"
          required
          value={form.education_field ?? ''}
          onChange={set('education_field')}
          placeholder="مثلاً برق الکترونیک"
        />
        <Field
          label="مقطع تحصیلی یا آخرین مدرک مرتبط"
          required
          value={form.education_degree ?? ''}
          onChange={set('education_degree')}
          placeholder="مثلاً کاردانی، کارشناسی، مدرک فنی‌حرفه‌ای"
        />
        <Field
          label="نام مرکز آموزشی (اختیاری)"
          value={form.education_center ?? ''}
          onChange={set('education_center')}
          placeholder="مثلاً دانشگاه آزاد واحد …"
        />
        <Field
          label="دوره‌های تخصصی گذرانده‌شده (اختیاری)"
          value={form.courses ?? ''}
          onChange={set('courses')}
          textarea
          placeholder="مثلاً دوره تعمیرات برد اصلی، BGA، تعمیرات لپ‌تاپ…"
        />
      </div>

      {/* ج) اطلاعات تخصصی */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <SectionTitle icon={Wrench} title="اطلاعات تخصصی" subtitle="گروه ج — ماده ۵-۴ قرارداد" />
        <Field
          label="زمینه‌های مهارتی مرتبط با تعمیرات برد"
          required
          value={form.skill_areas ?? ''}
          onChange={set('skill_areas')}
          placeholder="مثلاً تعمیرات برد اصلی موبایل، برد لپ‌تاپ، بردهای صنعتی"
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-700">
            سطح مهارت (خوداظهاری)<span className="text-rose-500"> *</span>
          </span>
          <div className="grid grid-cols-4 gap-2">
            {SKILL_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => { set('skill_level')(lvl); }}
                className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  form.skill_level === lvl
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-slate-200 bg-white text-ink-500'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </label>
        <Field
          label="سابقه فعالیت یا تجربه تعمیرات (اختیاری)"
          value={form.experience ?? ''}
          onChange={set('experience')}
          textarea
          placeholder="مثلاً ۵ سال تجربه تعمیرات برد موبایل در نمایندگی رسمی…"
        />
        <Field
          label="ابزارها و تجهیزات تخصصی در اختیار (اختیاری)"
          value={form.tools ?? ''}
          onChange={set('tools')}
          textarea
          placeholder="مثلاً هویه رقمی، میکروسکوپ، پاور ساپلای، هیتر…"
        />
      </div>

      {/* د) توضیحات تکمیلی */}
      <div className="glass rounded-2xl p-5 space-y-4">
        <SectionTitle icon={FileText} title="توضیحات تکمیلی" subtitle="گروه د — ماده ۵-۴ قرارداد" />
        <Field
          label="توضیحات متقاضی درباره سوابق و زمینه همکاری"
          value={form.description ?? ''}
          onChange={set('description')}
          textarea
          rows={5}
          placeholder="هر نکته‌ای که مایلید درباره سوابق و نحوه همکاری خود اعلام کنید…"
        />
      </div>

      {!requiredOk && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>فیلدهای ستاره‌دار برای تکمیل پرونده الزامی هستند (شهر، رشته، مقطع، زمینه مهارتی و سطح مهارت).</span>
        </div>
      )}

      {/* Save — fixed on mobile */}
      <div className="sticky bottom-20 lg:bottom-2 z-10">
        <button
          onClick={submit}
          disabled={saving}
          className="w-full py-4 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-bold shadow-glass transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
        </button>
      </div>

      <button
        onClick={() => setPage('dashboard')}
        className="w-full py-2.5 text-sm text-ink-500 hover:text-ink-700"
      >
        بازگشت به داشبورد
      </button>
    </div>
  );
}
