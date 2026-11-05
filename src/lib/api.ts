/**
 * ServiceYab (سرویس‌یاب) API client — calls a PHP JSON API endpoint.
 * The base URL is configurable from the admin panel and stored in localStorage.
 */

import { getItem, setItem, removeItem } from './safeStorage';

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || '';
const STORAGE_KEY = 'serviceyab_api_url';

function getApiUrl(): string {
  return getItem(STORAGE_KEY) || DEFAULT_API_URL;
}

export function setApiUrl(url: string) {
  if (url) setItem(STORAGE_KEY, url);
  else removeItem(STORAGE_KEY);
}

export function getStoredApiUrl(): string {
  return getItem(STORAGE_KEY) || DEFAULT_API_URL;
}

function getToken(): string | null {
  return getItem('serviceyab_token');
}

function setToken(token: string | null) {
  if (token) setItem('serviceyab_token', token);
  else removeItem('serviceyab_token');
}

export class OfflineError extends Error {
  constructor() {
    super('اینترنت شما قطع است. لطفاً اتصال خود را بررسی کنید.');
    this.name = 'OfflineError';
  }
}

export async function apiCall(action: string, body?: Record<string, unknown>): Promise<any> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new OfflineError();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(getApiUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new OfflineError();
    }
    throw new Error('ارتباط با سرور برقرار نشد. لطفاً اینترنت خود را بررسی کنید.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `API error ${res.status}`);
  }
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────
export async function otpSend(phone: string): Promise<{ code?: string; message: string; is_existing_user: boolean }> {
  const data = await apiCall('otp_send', { phone });
  return { code: data.code, message: data.message ?? 'کد ارسال شد', is_existing_user: data.is_existing_user ?? false };
}

export async function otpVerify(
  phone: string,
  code: string,
  fullName?: string,
  password?: string,
): Promise<{ token: string; user: AppUser; is_new_user: boolean }> {
  const data = await apiCall('otp_verify', { phone, code, full_name: fullName, password });
  setToken(data.session.access_token);
  return {
    token: data.session.access_token,
    user: data.session.user,
    is_new_user: data.is_new_user,
  };
}

export async function passwordLogin(
  phone: string,
  password: string,
): Promise<{ token: string; user: AppUser }> {
  const data = await apiCall('password_login', { phone, password });
  setToken(data.session.access_token);
  return { token: data.session.access_token, user: data.session.user };
}

export async function setPassword(password: string): Promise<void> {
  await apiCall('set_password', { password });
}

export async function updateAccount(fullName: string): Promise<AppUser | null> {
  const data = await apiCall('update_account', { full_name: fullName });
  return data.user ?? null;
}

export async function getMe(): Promise<AppUser | null> {
  try {
    const data = await apiCall('me');
    return data.user;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try { await apiCall('signout'); } catch {}
  setToken(null);
}

export function isAuthed(): boolean {
  return !!getToken();
}

// ─── Applicant profile (ماده ۵-۴) ─────────────────────────────
export interface ApplicantProfile {
  id: string;
  user_id: string;
  city: string;
  contact_extra: string;
  education_field: string;
  education_degree: string;
  education_center: string;
  courses: string;
  skill_areas: string;
  skill_level: string;
  experience: string;
  tools: string;
  description: string;
  profile_complete: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function fetchProfileApi(): Promise<ApplicantProfile> {
  const d = await apiCall('profile_get');
  return { ...d.data, profile_complete: !!(d.data?.profile_complete) } as ApplicantProfile;
}

export async function saveProfileApi(fields: Partial<ApplicantProfile>): Promise<{ profile_complete: boolean }> {
  const d = await apiCall('profile_save', fields as Record<string, unknown>);
  return { profile_complete: !!d.profile_complete };
}

// ─── Exam (ماده ۷) ────────────────────────────────────────────
export interface ExamInfo {
  title: string;
  duration_minutes: number;
  question_count: number;
  is_active: boolean;
  require_profile_complete: boolean;
  show_result_to_user: boolean;
  pass_score_percent: number;
  max_attempts: number;
}

export interface ExamStatus {
  exam: ExamInfo;
  profile_complete: boolean;
  used_attempts: number;
  remaining_attempts: number;
  available_questions: number;
  active_attempt: { id: string; expires_at: string; started_at: string } | null;
}

export interface ExamQuestion {
  id: string;
  index: number;
  text: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
}

export interface ExamState {
  attempt_id: string;
  status: 'in_progress' | 'completed' | 'expired';
  expires_at: string;
  started_at: string;
  questions: ExamQuestion[];
  answers: Record<string, number>;
}

export interface ExamResult {
  attempt_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  total?: number;
  score?: number;
  passed?: boolean;
  show_result?: boolean;
}

export async function examStatusApi(): Promise<ExamStatus> {
  const d = await apiCall('exam_status');
  return d.data as ExamStatus;
}

export async function examStartApi(): Promise<{ attempt_id: string; expires_at: string; resumed: boolean }> {
  const d = await apiCall('exam_start');
  return d.data;
}

export async function examStateApi(attemptId: string): Promise<ExamState> {
  const d = await apiCall('exam_state', { attempt_id: attemptId });
  return d.data as ExamState;
}

export async function examSaveProgressApi(attemptId: string, questionId: string, selectedOption: number): Promise<void> {
  await apiCall('exam_save_progress', { attempt_id: attemptId, question_id: questionId, selected_option: selectedOption });
}

export async function examSubmitApi(attemptId: string): Promise<{ status: string; score?: number; total?: number; percent?: number; passed?: boolean; already?: boolean }> {
  const d = await apiCall('exam_submit', { attempt_id: attemptId });
  return d.data;
}

export async function examResultApi(attemptId: string): Promise<ExamResult> {
  const d = await apiCall('exam_result', { attempt_id: attemptId });
  return d.data as ExamResult;
}

// ─── Admin (ماده ۸) ───────────────────────────────────────────
export interface AppUser {
  id: string;
  phone: string;
  full_name: string;
  is_admin?: boolean;
  status?: 'new' | 'in_review' | 'approved' | 'rejected';
  created_at?: string;
}

export interface AdminStats {
  total_applicants: number;
  new_applicants: number;
  in_review: number;
  approved: number;
  rejected: number;
  exam_participants: number;
}

export interface AdminApplicantRow {
  id: string;
  phone: string;
  full_name: string;
  status: 'new' | 'in_review' | 'approved' | 'rejected';
  created_at: string;
  city: string;
  profile_complete: boolean;
  attempt_id: string | null;
  attempt_status: string | null;
  attempt_score: number | null;
  attempt_total: number | null;
  attempt_passed: boolean | null;
}

export async function adminStatsGet(): Promise<AdminStats> {
  const d = await apiCall('admin_stats');
  return d.data as AdminStats;
}

export async function adminApplicantsListApi(params: {
  search?: string;
  status?: string;
  city?: string;
  exam_status?: '' | 'none' | 'completed';
}): Promise<AdminApplicantRow[]> {
  const d = await apiCall('admin_applicants_list', params as Record<string, unknown>);
  return d.data ?? [];
}

export async function adminApplicantGetApi(id: string): Promise<{
  applicant: { id: string; phone: string; full_name: string; status: string; created_at: string };
  profile: Partial<ApplicantProfile> | null;
  attempts: Array<{
    id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    score: number;
    total: number;
    passed: boolean;
    answers: Array<{
      question_id: string;
      selected_option: number;
      is_correct: number;
      text?: string;
      option1?: string;
      option2?: string;
      option3?: string;
      option4?: string;
      correct_option?: number;
    }>;
  }>;
}> {
  const d = await apiCall('admin_applicant_get', { id });
  return d.data;
}

export async function adminApplicantSetStatusApi(id: string, status: string): Promise<void> {
  await apiCall('admin_applicant_set_status', { id, status });
}

export async function adminApplicantsExportApi(): Promise<string> {
  const d = await apiCall('admin_applicants_export');
  return (d.data as string) ?? '';
}

// ─── Admin: questions ─────────────────────────────────────────
export interface AdminQuestion {
  id: string;
  text: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  correct_option: number;
  is_active: boolean;
  created_at?: string;
}

export async function adminQuestionsListApi(search?: string): Promise<AdminQuestion[]> {
  const d = await apiCall('admin_questions_list', { search: search ?? '' });
  return (d.data ?? []) as AdminQuestion[];
}

export async function adminQuestionCreateApi(q: Omit<AdminQuestion, 'id' | 'created_at'>): Promise<string> {
  const d = await apiCall('admin_questions_create', q as unknown as Record<string, unknown>);
  return d.data.id;
}

export async function adminQuestionUpdateApi(q: AdminQuestion): Promise<void> {
  await apiCall('admin_questions_update', q as unknown as Record<string, unknown>);
}

export async function adminQuestionToggleApi(id: string, isActive: boolean): Promise<void> {
  await apiCall('admin_questions_toggle', { id, is_active: isActive });
}

export async function adminQuestionDeleteApi(id: string): Promise<void> {
  await apiCall('admin_questions_delete', { id });
}

// ─── Admin: exam settings ─────────────────────────────────────
export interface AdminExamSettings {
  title: string;
  duration_minutes: number;
  question_count: number;
  pass_score_percent: number;
  max_attempts: number;
  show_result_to_user: boolean;
  require_profile_complete: boolean;
  is_active: boolean;
}

export async function adminExamGetApi(): Promise<AdminExamSettings> {
  const d = await apiCall('admin_exam_get');
  return {
    ...d.data,
    show_result_to_user: !!(d.data.show_result_to_user),
    require_profile_complete: !!(d.data.require_profile_complete),
    is_active: !!(d.data.is_active),
  } as AdminExamSettings;
}

export async function adminExamSaveApi(s: AdminExamSettings): Promise<void> {
  await apiCall('admin_exam_save', s as unknown as Record<string, unknown>);
}

// ─── Admin: settings (SMS + exam instructions) ────────────────
export interface AdminSettings {
  sms_api_key: string;
  sms_pattern_code: string;
  sms_line_number: string;
  exam_instructions: string;
}

export async function adminSettingsGet(): Promise<AdminSettings | null> {
  const d = await apiCall('admin_settings_get');
  return d.data ?? null;
}

export async function adminSettingsUpdate(patch: Partial<AdminSettings>): Promise<void> {
  await apiCall('admin_settings_update', patch);
}

// ─── Admin: admin accounts (بند ۸-۱) ──────────────────────────
export async function adminUserCreate(p: {
  phone: string;
  password: string;
  full_name: string;
  is_admin?: boolean;
}): Promise<string | null> {
  const d = await apiCall('admin_user_create', p);
  return d.data?.id ?? null;
}

export async function adminUserUpdate(id: string, patch: {
  full_name?: string;
  password?: string;
}): Promise<void> {
  await apiCall('admin_user_update', { id, ...patch });
}

export async function adminUserDelete(id: string): Promise<void> {
  await apiCall('admin_user_delete', { id });
}
