import { motion } from 'framer-motion';
import {
  FileText,
  ArrowLeft,
  Sparkles,
  ChevronLeft,
  Zap,
  Crown,
  Plus,
  Layers,
  Clock,
  LayoutGrid,
  TrendingUp,
  Briefcase,
  Scale,
  User,
  Building2,
  DollarSign,
  Users,
  FileSignature,
  FileCheck,
  Handshake,
} from 'lucide-react';
import { PLANS } from '@/data/plans';
import { useAppStore } from '@/store/appStore';
import { useArchiveStore } from '@/store/archiveStore';
import { useProfileStore } from '@/store/profileStore';
import { useAuthStore } from '@/store/authStore';
import { usePlanStore } from '@/store/planStore';
import { categoryLabels, categoryColors } from '@/data/templates';
import type { LetterCategory } from '@/types';

const templateCategories: { id: LetterCategory; icon: typeof FileText }[] = [
  { id: 'administrative', icon: Briefcase },
  { id: 'legal', icon: Scale },
  { id: 'personal', icon: User },
  { id: 'official', icon: Building2 },
  { id: 'financial', icon: DollarSign },
  { id: 'hr', icon: Users },
  { id: 'contract', icon: FileSignature },
  { id: 'document', icon: FileCheck },
  { id: 'pledge', icon: FileText },
  { id: 'agreement', icon: Handshake },
];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const steps = [
  { title: 'کشف یا انتخاب قالب', desc: 'نوع مکتوب را هوشمندانه پیدا کنید' },
  { title: 'پاسخ به پرسش‌ها', desc: 'اطلاعات مورد نیاز را وارد کنید' },
  { title: 'دریافت مکتوب', desc: 'متن نهایی را ویرایش و ذخیره کنید' },
];

export function Dashboard() {
  const setPage = useAppStore((s) => s.setPage);
  const setEditingLetterId = useAppStore((s) => s.setEditingLetterId);
  const setGeneratedContent = useAppStore((s) => s.setGeneratedContent);
  const letters = useArchiveStore((s) => s.letters);
  const profiles = useProfileStore((s) => s.profiles);
  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];

  const user = useAuthStore((s) => s.user);
  const userFullName = user?.full_name || '';
  const planType = usePlanStore((s) => s.planType);
  const expiresAt = usePlanStore((s) => s.expiresAt);
  const aiAssistantUsage = usePlanStore((s) => s.aiAssistantUsage);
  const templateUsage = usePlanStore((s) => s.templateUsage);
  const getAiAssistantLimit = usePlanStore((s) => s.getAiAssistantLimit);
  const getTemplateLimit = usePlanStore((s) => s.getTemplateLimit);
  const currentPlan = PLANS.find((p) => p.id === planType);
  const aiRemaining = getAiAssistantLimit() - aiAssistantUsage;
  const templateRemaining = getTemplateLimit() - templateUsage;
  const greetingName = userFullName
    ? userFullName.split(' ')[0]
    : defaultProfile
      ? defaultProfile.fullName.split(' ')[0]
      : 'کاتب شما';

  const recentLetters = letters.slice(0, 3);

  const stats = [
    { label: 'مکتوب‌های ساخته‌شده', value: letters.length, icon: FileText, color: 'from-sky-400 to-sky-600', bg: 'bg-sky-50', text: 'text-sky-600' },
    { label: 'پروفایل‌ها', value: profiles.length, icon: Layers, color: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { label: 'اعتبار هوشمند', value: aiRemaining, icon: Zap, color: 'from-cyan-400 to-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero greeting */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="hero-workflow relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20"
      >
        <div className="absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -left-16 bottom-0 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-teal-300 text-sm mb-2">
            <Sparkles className="h-4 w-4" />
            خوش آمدید
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            {defaultProfile ? `سلام، ${greetingName}` : 'کاتب شما'}
          </h2>
          <p className="text-teal-100 text-sm sm:text-base max-w-md leading-relaxed">
            دستیار هوشمند نگارش مکتوب — در چند مرحله ساده، متن رسمی و حرفه‌ای خود را بسازید، ویرایش کنید و ذخیره نمایید.
          </p>

          {/* Big + button for smart discovery */}
          <button
            onClick={() => setPage('discovery')}
            className="group mt-5 flex w-full items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur-sm transition-all hover:bg-white/20"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-lg shadow-amber-500/30 transition-transform group-hover:scale-110">
              <Plus className="h-7 w-7" />
            </div>
            <div className="flex-1 text-right">
              <p className="text-sm font-bold text-white">شروع مکتوب جدید</p>
              <p className="text-xs text-teal-200 mt-0.5">
                با کشف هوشمند، نوع مکتوب خود را پیدا کنید
              </p>
            </div>
            <ArrowLeft className="h-5 w-5 text-teal-300 transition-transform group-hover:-translate-x-1 shrink-0" />
          </button>
        </div>
      </motion.div>

      {/* Steps + templates */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="glass rounded-2xl p-5 shadow-glass"
      >
        <h3 className="text-base font-bold text-slate-900 mb-1">چطور مکتوب بسازیم؟</h3>
        <p className="text-xs text-slate-500 mb-4">
          در ۳ مرحله ساده مکتوب خود را بسازید، یا از قالب‌های آماده زیر استفاده کنید.
        </p>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="relative rounded-xl bg-slate-50/80 p-3 text-center"
            >
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-sky-700 text-white text-xs font-bold">
                {(i + 1).toLocaleString('fa-IR')}
              </div>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">{step.title}</p>
              <p className="mt-1 text-[10px] text-slate-400 leading-tight">{step.desc}</p>
              {i < steps.length - 1 && (
                <div className="absolute -left-1.5 top-1/2 hidden -translate-y-1/2 text-slate-300 sm:block">
                  <ChevronLeft className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Template categories */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center gap-1.5">
            <LayoutGrid className="h-4 w-4 text-sky-500" />
            <h4 className="text-sm font-bold text-slate-900">دسته‌بندی قالب‌ها</h4>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {templateCategories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setPage('templates')}
                  className="group flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-3 text-center transition-all hover:border-sky-200 hover:shadow-md"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${categoryColors[cat.id]} text-white shadow-sm transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">{categoryLabels[cat.id]}</p>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              custom={i + 1}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className="glass rounded-2xl p-4 sm:p-5 shadow-glass"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.text} mb-3`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {stat.value.toLocaleString('fa-IR')}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Plan + usage */}
      <motion.div
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="relative overflow-hidden glass rounded-2xl p-5 shadow-glass"
      >
        <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-indigo-200/30 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${currentPlan?.gradient ?? 'from-slate-400 to-slate-600'} text-white shadow-lg`}>
            {planType === 'pro' ? <Crown className="h-7 w-7" /> : planType === 'basic' ? <Zap className="h-7 w-7" /> : <Layers className="h-7 w-7" />}
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500">طرح اشتراک شما</p>
            <p className="text-lg font-bold text-slate-900">طرح {currentPlan?.name ?? 'آزمایشی'}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-[11px] text-cyan-600 font-medium">
                {aiRemaining.toLocaleString('fa-IR')} اعتبار هوشمند
              </span>
              <span className="text-[11px] text-indigo-500 font-medium">
                {templateRemaining.toLocaleString('fa-IR')} اعتبار قالب
              </span>
              {expiresAt ? (
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  انقضا: {new Date(expiresAt).toLocaleDateString('fa-IR')}
                </span>
              ) : planType === 'free' && (
                <span className="text-[11px] text-slate-400 font-medium">بدون انقضا</span>
              )}
            </div>
          </div>
          {planType !== 'pro' && (
            <button
              onClick={() => setPage('pricing')}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
            >
              <Crown className="h-4 w-4" />
              ارتقای طرح
            </button>
          )}
        </div>
      </motion.div>

      {/* Recent letters */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-900">مکتوب‌های اخیر</h3>
          {letters.length > 0 && (
            <button
              onClick={() => setPage('archive')}
              className="flex items-center gap-1 text-sm text-sky-600 hover:text-sky-700 font-medium"
            >
              مشاهده همه
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {recentLetters.length === 0 ? (
          <motion.div
            custom={5}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="glass rounded-2xl p-8 text-center shadow-glass"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-400 mb-4">
              <FileText className="h-8 w-8" />
            </div>
            <p className="text-sm font-semibold text-slate-700">هنوز مکتوبی نساخته‌اید</p>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
              با انتخاب یک قالب آماده یا استفاده از کشف هوشمند، اولین مکتوب خود را در کمتر از یک دقیقه ایجاد کنید
            </p>
            <button
              onClick={() => setPage('discovery')}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-500/20"
            >
              <Sparkles className="h-4 w-4" />
              شروع کشف هوشمند
            </button>
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            {recentLetters.map((letter, i) => (
              <motion.button
                key={letter.id}
                custom={i + 6}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                onClick={() => {
                  setEditingLetterId(letter.id);
                  setGeneratedContent(letter.content);
                  setPage('preview');
                }}
                className="w-full glass rounded-2xl p-4 shadow-glass hover:shadow-glass-lg transition-shadow text-right flex items-center gap-4 group"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white group-hover:scale-105 transition-transform">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {letter.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span className="truncate">{letter.templateTitle}</span>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3" />
                      {new Date(letter.createdAt).toLocaleDateString('fa-IR')}
                    </span>
                  </p>
                </div>
                <ArrowLeft className="h-4 w-4 text-slate-400 group-hover:text-sky-500 transition-colors shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </section>

      {/* Profile summary */}
      {defaultProfile && (
        <section>
          <motion.div
            custom={9}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="glass rounded-2xl p-5 shadow-glass"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">پروفایل فعال</h3>
              <button
                onClick={() => setPage('profile')}
                className="text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                مدیریت
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white text-lg font-bold">
                {defaultProfile.fullName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {defaultProfile.fullName}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {defaultProfile.jobTitle} · {defaultProfile.organization}
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-slate-300 shrink-0" />
            </div>
          </motion.div>
        </section>
      )}
    </div>
  );
}
