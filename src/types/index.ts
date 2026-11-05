export type PageId =
  | 'landing'
  | 'dashboard'
  | 'profile'
  | 'exam-intro'
  | 'exam-run'
  | 'exam-result'
  | 'admin'
  | 'account';

/** وضعیت بررسی درخواست همکاری — ماده ۸-۶ قرارداد */
export type ApplicantStatus = 'new' | 'in_review' | 'approved' | 'rejected';

export const STATUS_LABELS: Record<ApplicantStatus, string> = {
  new: 'جدید',
  in_review: 'در حال بررسی',
  approved: 'تأیید اولیه',
  rejected: 'ردشده',
};

export const STATUS_COLORS: Record<ApplicantStatus, string> = {
  new: 'bg-sky-100 text-sky-700',
  in_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
};
