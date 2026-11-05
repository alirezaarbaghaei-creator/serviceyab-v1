import {
  ArrowLeft, BadgeCheck, ClipboardList, Cpu, FileSearch, Handshake,
  Map, MessageCircleQuestion, ShieldCheck, UserPlus, Users, Wrench,
} from 'lucide-react';

// متن‌های این صفحه خنثی نگه‌داشته شده‌اند تا پیش از انتشار، با تأیید کارفرما
// نهایی شوند (ماده ۴-۱ و ۴-۲ قرارداد: محتوا بر اساس اطلاعات مورد تأیید کارفرما).

const BENEFITS = [
  {
    icon: Users,
    title: 'عضویت در شبکه تخصصی',
    description: 'فرصت عضویت در شبکه تخصصی تعمیرات بردهای الکترونیکی که به‌صورت مرحله‌ای تشکیل می‌شود.',
  },
  {
    icon: BadgeCheck,
    title: 'ارزیابی شفاف تخصص',
    description: 'با تکمیل پروفایل حرفه‌ای و آزمون تخصصی آنلاین، مهارت شما به‌صورت ساختاریافته بررسی می‌شود.',
  },
  {
    icon: FileSearch,
    title: 'پرونده حرفه‌ای',
    description: 'اطلاعات فردی، آموزشی و تخصصی شما در یک پرونده منظم نگهداری و مبنای بررسی قرار می‌گیرد.',
  },
  {
    icon: ShieldCheck,
    title: 'حفاظت از اطلاعات',
    description: 'اطلاعات شما به‌صورت محرمانه نگهداری می‌شود و فقط توسط تیم بررسی شرکت مشاهده می‌گردد.',
  },
];

// مراحل ثبت‌نام و ارزیابی — عیناً مطابق ماده ۴-۳ قرارداد
const STEPS = [
  { icon: UserPlus, title: 'ایجاد حساب کاربری', description: 'با شماره تلفن همراه و کد تأیید پیامکی ثبت‌نام کنید.' },
  { icon: FileSearch, title: 'تکمیل اطلاعات اولیه', description: 'نام و اطلاعات تماس خود را وارد کنید.' },
  { icon: Wrench, title: 'تکمیل اطلاعات آموزشی و تخصصی', description: 'سوابق تحصیلی، مهارت‌ها و تجربه خود را ثبت کنید.' },
  { icon: ClipboardList, title: 'شرکت در آزمون', description: 'در صورت فعال‌بودن آزمون، در آزمون چهارگزینه‌ای تخصصی شرکت کنید.' },
  { icon: Users, title: 'بررسی توسط شرکت', description: 'اطلاعات و نتیجه آزمون شما توسط کارشناسان بررسی می‌شود.' },
  { icon: Map, title: 'مشاهده وضعیت درخواست', description: 'وضعیت بررسی درخواست را در پنل کاربری خود دنبال کنید.' },
];

const FAQS = [
  {
    q: 'ثبت‌نام در سرویس‌یاب چه شرایطی دارد؟',
    a: 'برای ثبت‌نام فقط به شماره تلفن همراه فعال نیاز دارید. پس از ایجاد حساب، تکمیل اطلاعات فردی، آموزشی و تخصصی الزامی است.',
  },
  {
    q: 'آزمون تخصصی شامل چه بخش‌هایی است؟',
    a: 'آزمون شامل سؤالات چهارگزینه‌ای در زمینه تعمیرات بردهای الکترونیکی است. زمان و تعداد سؤالات در دستورالعمل آزمون اعلام می‌شود و پاسخ‌ها به‌صورت خودکار تصحیح می‌گردند.',
  },
  {
    q: 'آیا می‌توانم چند بار در آزمون شرکت کنم؟',
    a: 'تعداد دفعات مجاز شرکت در آزمون مطابق سیاست شرکت و در دستورالعمل آزمون اعلام می‌شود. در حالت پایه یک بار شرکت در آزمون مجاز است.',
  },
  {
    q: 'نتیجه آزمون را از کجا می‌بینم؟',
    a: 'نتیجه یا وضعیت آزمون مطابق سیاست اعلام‌شده در پنل کاربری شما نمایش داده می‌شود. نتیجه نهایی بررسی درخواست نیز در همان پنل قابل مشاهده است.',
  },
  {
    q: 'آیا ثبت‌نام به معنای تضمین همکاری است؟',
    a: 'خیر. نتیجه آزمون و بررسی اولیه صرفاً بخشی از فرایند ارزیابی است و به‌تنهایی به معنای تأیید نهایی تخصص یا اعطای نمایندگی نیست.',
  },
  {
    q: 'اطلاعات من چگونه محافظت می‌شود؟',
    a: 'اطلاعات پرونده شما به سایر کاربران نمایش داده نمی‌شود و فقط برای بررسی اولیه توسط افراد مجاز شرکت استفاده می‌گردد.',
  },
];

export function Landing({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary-200/40 blur-3xl" />
          <div className="absolute top-40 -left-32 h-80 w-80 rounded-full bg-cyan-200/30 blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 border border-primary-100 px-4 py-1.5 text-xs font-semibold text-primary-700 mb-6">
            <Cpu className="h-3.5 w-3.5" />
            سامانه ارزیابی و جذب متقاضیان همکاری
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-ink-900 leading-[1.3]">
            سرویس‌یاب
          </h1>
          <p className="text-lg sm:text-xl text-ink-600 mt-4 font-medium">
            شبکه تخصصی تعمیرات بردهای الکترونیکی
          </p>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-ink-500 leading-8 mt-5">
            سرویس‌یاب زیرساخت اولیه تشکیل شبکه تخصصی تعمیرات بردهای الکترونیکی است.
            متقاضیان همکاری با تکمیل پروفایل حرفه‌ای و شرکت در آزمون تخصصی آنلاین،
            به‌صورت ساختاریافته ارزیابی می‌شوند.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <button
              onClick={onEnter}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold shadow-glass transition-colors flex items-center justify-center gap-2"
            >
              شروع ثبت‌نام و ورود
              <ArrowLeft className="h-5 w-5" />
            </button>
            <a
              href="#steps"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl glass font-bold text-ink-700 hover:shadow-glass transition-shadow"
            >
              مراحل ثبت‌نام
            </a>
          </div>
        </div>
      </header>

      {/* Benefits — ماده ۴-۲ */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-bold text-ink-900 text-center">چرا سرویس‌یاب؟</h2>
        <p className="text-sm text-ink-500 text-center mt-2 mb-10">
          اهداف و مزایای پیوستن به شبکه تخصصی
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {BENEFITS.map((b) => (
            <div key={b.title} className="glass rounded-2xl p-6">
              <div className="h-12 w-12 rounded-xl bg-primary-100 flex items-center justify-center mb-4">
                <b.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="font-bold text-ink-900 mb-2">{b.title}</h3>
              <p className="text-sm text-ink-500 leading-7">{b.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps — ماده ۴-۳ */}
      <section id="steps" className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-bold text-ink-900 text-center">مراحل ثبت‌نام و ارزیابی</h2>
        <p className="text-sm text-ink-500 text-center mt-2 mb-10">
          مسیر ورود شما به شبکه تخصصی سرویس‌یاب در شش گام
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="glass rounded-2xl p-5 relative">
              <span className="absolute top-4 left-4 h-7 w-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                {new Intl.NumberFormat('fa-IR').format(i + 1)}
              </span>
              <div className="h-11 w-11 rounded-xl bg-cyan-100 flex items-center justify-center mb-3">
                <s.icon className="h-5 w-5 text-cyan-600" />
              </div>
              <h3 className="font-bold text-ink-900 mb-1.5 text-sm">{s.title}</h3>
              <p className="text-xs text-ink-500 leading-6">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ — ماده ۴-۴ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="text-2xl font-bold text-ink-900 text-center flex items-center justify-center gap-2">
          <MessageCircleQuestion className="h-6 w-6 text-primary-500" />
          سؤالات متداول
        </h2>
        <p className="text-sm text-ink-500 text-center mt-2 mb-8">پاسخ پرسش‌های عمومی متقاضیان</p>
        <div className="space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="glass rounded-2xl group">
              <summary className="flex items-center justify-between cursor-pointer list-none p-5 font-semibold text-sm text-ink-800">
                {f.q}
                <span className="text-primary-500 group-open:rotate-45 transition-transform text-xl leading-none">+</span>
              </summary>
              <p className="px-5 pb-5 text-sm text-ink-500 leading-7">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-gradient-to-l from-primary-600 to-cyan-600 p-10 text-center text-white">
          <Handshake className="h-10 w-10 mx-auto mb-4 opacity-90" />
          <h2 className="text-2xl font-bold">آماده شروع همکاری هستید؟</h2>
          <p className="text-sm opacity-90 mt-2 mb-6">
            همین حالا حساب کاربری بسازید و پرونده همکاری خود را تکمیل کنید.
          </p>
          <button
            onClick={onEnter}
            className="px-8 py-3.5 rounded-xl bg-white text-primary-700 font-bold hover:bg-primary-50 transition-colors"
          >
            ورود یا ثبت‌نام
          </button>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-ink-400">
        سرویس‌یاب — سامانه ارزیابی اولیه متقاضیان همکاری
      </footer>
    </div>
  );
}
