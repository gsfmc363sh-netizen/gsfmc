create extension if not exists pgcrypto;

create table if not exists public.culture_day_applications (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null,
  department text not null,
  contact_name text not null,
  contact_phone text not null,
  participant_name text not null,
  employment_type text not null,
  session_no integer not null check (session_no between 1 and 5),
  session_date date not null,
  program text not null,
  venue text not null,
  created_at timestamptz not null default now()
);

alter table public.culture_day_applications enable row level security;

-- 내부 신청 페이지에서 익명 접수 허용
create policy "allow anonymous insert"
on public.culture_day_applications
for insert
to anon
with check (true);

-- 주의: 아래 익명 조회 정책은 전 부서 취합 화면을 바로 사용하기 위한 기본 예시입니다.
-- 실운영에서는 직원 인증(Supabase Auth/사내 SSO)을 붙인 뒤 authenticated 전용으로 바꾸세요.
create policy "allow anonymous read"
on public.culture_day_applications
for select
to anon
using (true);
