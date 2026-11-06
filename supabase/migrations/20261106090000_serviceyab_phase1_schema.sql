-- ServiceYab Phase 1 schema
-- Apply ONLY to a fresh Supabase project created for ServiceYab.
-- Never apply this migration to the legacy Kateb database.

create extension if not exists pgcrypto;

create type public.application_status as enum ('new', 'reviewing', 'pre_approved', 'rejected');

create table public.applicant_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  city text not null default '',
  education_field text not null default '',
  education_level text not null default '',
  education_center text not null default '',
  completed_courses text not null default '',
  skills text[] not null default '{}',
  self_assessed_level text not null default '',
  experience text not null default '',
  equipment text not null default '',
  notes text not null default '',
  status public.application_status not null default 'new',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.exam_settings (
  id boolean primary key default true check (id),
  is_active boolean not null default false,
  duration_minutes integer not null default 30 check (duration_minutes between 1 and 240),
  question_count integer not null default 20 check (question_count between 1 and 50),
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  passing_score numeric(5,2),
  show_score_to_applicant boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.exam_settings(id) values (true) on conflict do nothing;

create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Correct answers are deliberately stored separately and are never exposed to applicants.
create table public.exam_answer_keys (
  question_id uuid primary key references public.exam_questions(id) on delete cascade,
  correct_option smallint not null check (correct_option between 0 and 3)
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  score numeric(5,2),
  correct_count integer,
  total_questions integer not null,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','expired')),
  created_at timestamptz not null default now()
);

create table public.exam_attempt_questions (
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete restrict,
  display_order integer not null,
  primary key (attempt_id, question_id),
  unique (attempt_id, display_order)
);

create table public.exam_answers (
  attempt_id uuid not null,
  question_id uuid not null,
  selected_option smallint not null check (selected_option between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (attempt_id, question_id),
  foreign key (attempt_id, question_id) references public.exam_attempt_questions(attempt_id, question_id) on delete cascade
);

create index applicant_profiles_status_idx on public.applicant_profiles(status);
create index applicant_profiles_city_idx on public.applicant_profiles(city);
create index exam_attempts_applicant_idx on public.exam_attempts(applicant_id, created_at desc);
create index exam_questions_active_order_idx on public.exam_questions(is_active, sort_order);

create or replace function public.is_serviceyab_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$ begin new.updated_at = now(); return new; end $$;

create trigger applicant_profiles_updated_at before update on public.applicant_profiles
for each row execute function public.set_updated_at();
create trigger exam_questions_updated_at before update on public.exam_questions
for each row execute function public.set_updated_at();

alter table public.applicant_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.exam_settings enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_answer_keys enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_attempt_questions enable row level security;
alter table public.exam_answers enable row level security;

create policy "applicant reads own profile" on public.applicant_profiles
for select to authenticated using (user_id = auth.uid() or public.is_serviceyab_admin());
create policy "applicant creates own profile" on public.applicant_profiles
for insert to authenticated with check (user_id = auth.uid() and status = 'new');
create policy "applicant updates own profile" on public.applicant_profiles
for update to authenticated using (user_id = auth.uid() or public.is_serviceyab_admin())
with check (user_id = auth.uid() or public.is_serviceyab_admin());
create policy "admins manage all applicant profiles" on public.applicant_profiles
for all to authenticated using (public.is_serviceyab_admin()) with check (public.is_serviceyab_admin());

create policy "users read own role" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.is_serviceyab_admin());
-- Role assignment is intentionally not available to ordinary authenticated clients.

create policy "authenticated read exam settings" on public.exam_settings
for select to authenticated using (true);
create policy "admins manage exam settings" on public.exam_settings
for all to authenticated using (public.is_serviceyab_admin()) with check (public.is_serviceyab_admin());

create policy "applicants read active question text" on public.exam_questions
for select to authenticated using (is_active or public.is_serviceyab_admin());
create policy "admins manage questions" on public.exam_questions
for all to authenticated using (public.is_serviceyab_admin()) with check (public.is_serviceyab_admin());

create policy "admins manage answer keys" on public.exam_answer_keys
for all to authenticated using (public.is_serviceyab_admin()) with check (public.is_serviceyab_admin());

create policy "applicant reads own attempts" on public.exam_attempts
for select to authenticated using (applicant_id = auth.uid() or public.is_serviceyab_admin());
create policy "applicant reads own attempt questions" on public.exam_attempt_questions
for select to authenticated using (
  exists (select 1 from public.exam_attempts a where a.id = attempt_id and (a.applicant_id = auth.uid() or public.is_serviceyab_admin()))
);
create policy "applicant reads and writes own answers" on public.exam_answers
for all to authenticated using (
  exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.applicant_id = auth.uid() and a.status = 'in_progress' and a.expires_at > now())
) with check (
  exists (select 1 from public.exam_attempts a where a.id = attempt_id and a.applicant_id = auth.uid() and a.status = 'in_progress' and a.expires_at > now())
);

-- Only an administrator may change a candidate's review status or private note.
create or replace function public.admin_set_applicant_review(
  p_user_id uuid,
  p_status public.application_status,
  p_admin_note text default ''
)
returns void language plpgsql security definer set search_path = public
as $
begin
  if auth.uid() is null or not public.is_serviceyab_admin() then
    raise exception 'not_authorized';
  end if;
  update public.applicant_profiles
  set status = p_status, admin_note = coalesce(p_admin_note, '')
  where user_id = p_user_id;
  if not found then raise exception 'applicant_not_found'; end if;
end;
$;
revoke all on function public.admin_set_applicant_review(uuid, public.application_status, text) from public;
grant execute on function public.admin_set_applicant_review(uuid, public.application_status, text) to authenticated;

-- Attempt creation and scoring are server-side. Applicants never receive the answer key.
create or replace function public.start_serviceyab_exam()
returns table(attempt_id uuid, expires_at timestamptz, question_id uuid, prompt text, options jsonb, display_order integer)
language plpgsql security definer set search_path = public
as $$
declare
  settings public.exam_settings%rowtype;
  new_attempt uuid;
  chosen_count integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into settings from public.exam_settings where id = true;
  if not found or not settings.is_active then raise exception 'exam_unavailable'; end if;
  update public.exam_attempts set status = 'expired' where applicant_id = auth.uid() and status = 'in_progress' and expires_at <= now();
  if not exists (select 1 from public.applicant_profiles p where p.user_id = auth.uid() and length(trim(p.full_name)) > 1 and length(trim(p.city)) > 1) then
    raise exception 'profile_incomplete';
  end if;
  if (select count(*) from public.exam_attempts a where a.applicant_id = auth.uid() and a.status = 'submitted') >= settings.max_attempts then
    raise exception 'attempt_limit_reached';
  end if;
  if exists (select 1 from public.exam_attempts a where a.applicant_id = auth.uid() and a.status = 'in_progress') then
    raise exception 'active_attempt_exists';
  end if;
  select count(*) into chosen_count from public.exam_questions q where q.is_active;
  if chosen_count < settings.question_count then raise exception 'not_enough_questions'; end if;
  insert into public.exam_attempts(applicant_id, expires_at, total_questions)
  values (auth.uid(), now() + make_interval(mins => settings.duration_minutes), settings.question_count)
  returning id into new_attempt;
  insert into public.exam_attempt_questions(attempt_id, question_id, display_order)
  select new_attempt, q.id, row_number() over (order by random())::integer
  from (select id from public.exam_questions where is_active order by random() limit settings.question_count) q;
  return query
    select new_attempt, a.expires_at, q.id, q.prompt, q.options, aq.display_order
    from public.exam_attempts a
    join public.exam_attempt_questions aq on aq.attempt_id = a.id
    join public.exam_questions q on q.id = aq.question_id
    where a.id = new_attempt order by aq.display_order;
end;
$$;

create or replace function public.submit_serviceyab_exam(p_attempt_id uuid)
returns table(score numeric, correct_count integer, total_questions integer, submitted_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  attempt_row public.exam_attempts%rowtype;
  correct integer;
  submitted timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into attempt_row from public.exam_attempts
  where id = p_attempt_id and applicant_id = auth.uid()
  for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if attempt_row.status <> 'in_progress' then raise exception 'attempt_already_submitted'; end if;
  if attempt_row.expires_at < now() then
    update public.exam_attempts set status = 'expired', submitted_at = submitted where id = p_attempt_id;
    return query select null::numeric, null::integer, attempt_row.total_questions, submitted;
    return;
  end if;
  select count(*) into correct
  from public.exam_attempt_questions aq
  join public.exam_answer_keys k on k.question_id = aq.question_id
  join public.exam_answers ans on ans.attempt_id = aq.attempt_id and ans.question_id = aq.question_id
  where aq.attempt_id = p_attempt_id and ans.selected_option = k.correct_option;
  update public.exam_attempts a
  set correct_count = correct,
      score = round((correct::numeric / greatest(a.total_questions,1)) * 100, 2),
      status = 'submitted',
      submitted_at = submitted
  where a.id = p_attempt_id;
  return query select a.score, a.correct_count, a.total_questions, a.submitted_at
    from public.exam_attempts a where a.id = p_attempt_id;
end;
$$;

revoke all on function public.start_serviceyab_exam() from public;
revoke all on function public.submit_serviceyab_exam(uuid) from public;
grant execute on function public.start_serviceyab_exam() to authenticated;
grant execute on function public.submit_serviceyab_exam(uuid) to authenticated;

grant select, insert on public.applicant_profiles to authenticated;
revoke update on public.applicant_profiles from authenticated;
grant update (full_name, phone, city, education_field, education_level, education_center, completed_courses, skills, self_assessed_level, experience, equipment, notes) on public.applicant_profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.exam_settings to authenticated;
grant select on public.exam_questions to authenticated;
grant select on public.exam_attempts to authenticated;
grant select on public.exam_attempt_questions to authenticated;
grant select, insert, update, delete on public.exam_answers to authenticated;
grant select, insert, update, delete on public.exam_answer_keys to authenticated;

-- Enforce the contractual maximum bank size at the database boundary.
create or replace function public.enforce_serviceyab_question_limit()
returns trigger language plpgsql set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(78234191);
  if (select count(*) from public.exam_questions) >= 50 then
    raise exception 'question_bank_limit_reached';
  end if;
  return new;
end;
$$;
create trigger exam_questions_max_50 before insert on public.exam_questions
for each row execute function public.enforce_serviceyab_question_limit();

-- Candidate-facing reads intentionally exclude private administrator notes.
revoke select on public.applicant_profiles from authenticated;
grant select (
  user_id, full_name, phone, city, education_field, education_level,
  education_center, completed_courses, skills, self_assessed_level,
  experience, equipment, notes, status, created_at, updated_at
) on public.applicant_profiles to authenticated;

-- Applicants do not query raw attempt rows: score fields are private unless exposed
-- through the application policy. Administrators use a guarded RPC instead.
revoke all on public.exam_attempts from authenticated;

create or replace function public.admin_list_exam_attempts()
returns table(
  id uuid,
  applicant_id uuid,
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric,
  status text,
  total_questions integer
)
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_serviceyab_admin() then
    raise exception 'not_authorized';
  end if;
  return query
    select a.id, a.applicant_id, a.started_at, a.submitted_at, a.score, a.status, a.total_questions
    from public.exam_attempts a order by a.started_at desc;
end;
$$;
revoke all on function public.admin_list_exam_attempts() from public;
grant execute on function public.admin_list_exam_attempts() to authenticated;

-- Table privileges are broad only for authenticated users; RLS still confines
-- all question/settings/answer-key writes to the administrator role.
grant insert, update, delete on public.exam_settings to authenticated;
grant insert, update, delete on public.exam_questions to authenticated;
grant select, insert, update, delete on public.exam_answer_keys to authenticated;

create or replace function public.admin_create_exam_question(
  p_prompt text,
  p_options jsonb,
  p_correct_option smallint,
  p_is_active boolean default true
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare qid uuid;
begin
  if auth.uid() is null or not public.is_serviceyab_admin() then raise exception 'not_authorized'; end if;
  if length(trim(coalesce(p_prompt,''))) < 3 then raise exception 'invalid_question'; end if;
  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) <> 4 then raise exception 'exactly_four_options_required'; end if;
  if p_correct_option not between 0 and 3 then raise exception 'invalid_correct_option'; end if;
  insert into public.exam_questions(prompt, options, is_active)
  values (trim(p_prompt), p_options, coalesce(p_is_active,true))
  returning id into qid;
  insert into public.exam_answer_keys(question_id, correct_option) values (qid, p_correct_option);
  return qid;
end;
$$;
revoke all on function public.admin_create_exam_question(text,jsonb,smallint,boolean) from public;
grant execute on function public.admin_create_exam_question(text,jsonb,smallint,boolean) to authenticated;
