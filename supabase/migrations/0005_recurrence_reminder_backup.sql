-- 반복 일정 · 알림 · 백업 복원
--
-- 반복은 규칙 한 줄(jsonb)만 저장한다. 날짜별 행을 미리 만들지 않는다 —
-- '매일'을 1년치로 펼치면 한 사람이 365행을 쓰고, 규칙을 고치면 그 365행을 다시 손봐야 한다.
-- 대신 "그 회차를 체크했다"는 사실만 task_occurrences에 남긴다.

-- ── tasks 확장 ──────────────────────────────
alter table public.tasks
  add column if not exists recurrence jsonb,
  add column if not exists reminder text not null default 'none',
  add column if not exists reminder_time text not null default '09:00';

alter table public.tasks drop constraint if exists tasks_reminder_check;
alter table public.tasks add constraint tasks_reminder_check
  check (reminder in ('none','at','10m','1h','1d'));

alter table public.tasks drop constraint if exists tasks_reminder_time_check;
alter table public.tasks add constraint tasks_reminder_time_check
  check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ── 반복 회차 완료 기록 ──────────────────────
-- (task_id, date)가 기본키라 같은 회차를 두 번 눌러도 행이 하나다.
create table if not exists public.task_occurrences (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date     date not null,
  created_at timestamptz not null default now(),
  primary key (task_id, date)
);

create index if not exists task_occurrences_owner_date_idx
  on public.task_occurrences (owner_id, date);

alter table public.task_occurrences enable row level security;

drop policy if exists "own occurrences" on public.task_occurrences;
create policy "own occurrences" on public.task_occurrences
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ── 검색 ────────────────────────────────────
-- ilike '%…%'는 인덱스를 타지 못한다. trigram으로 제목 부분 일치를 받쳐 준다.
create extension if not exists pg_trgm with schema extensions;
create index if not exists tasks_title_trgm_idx
  on public.tasks using gin (title extensions.gin_trgm_ops);

-- ── 백업 복원 ────────────────────────────────
-- 지우고 넣는 일을 클라이언트에서 나눠 하면 중간에 끊겼을 때 데이터가 사라진 채 끝난다.
-- 함수 하나로 보내면 전부 되거나 전부 안 되거나 둘 중 하나가 된다.
--
-- security invoker + RLS: 자기 데이터만 지우고 자기 것으로만 넣을 수 있다.
create or replace function public.restore_backup(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception '로그인이 필요합니다';
  end if;

  delete from public.task_occurrences where owner_id = uid;
  delete from public.tasks      where owner_id = uid;
  delete from public.categories where owner_id = uid;

  insert into public.categories (id, owner_id, name, color, sort_order)
  select (c->>'id')::uuid, uid, c->>'name', c->>'color',
         coalesce((c->>'sort_order')::int, 0)
  from jsonb_array_elements(coalesce(payload->'categories', '[]'::jsonb)) c;

  insert into public.tasks (
    id, owner_id, category_id, title, memo, start_date, end_date,
    check_mode, done, completed_dates, recurrence, reminder, reminder_time, sort_order
  )
  select
    (t->>'id')::uuid,
    uid,
    nullif(t->>'category_id', '')::uuid,
    t->>'title',
    t->>'memo',
    (t->>'start_date')::date,
    (t->>'end_date')::date,
    coalesce(t->>'check_mode', 'once'),
    coalesce((t->>'done')::boolean, false),
    coalesce(
      (select array_agg(d::date)
         from jsonb_array_elements_text(t->'completed_dates') as d),
      '{}'::date[]
    ),
    case when t->'recurrence' is null or t->'recurrence' = 'null'::jsonb
         then null else t->'recurrence' end,
    coalesce(t->>'reminder', 'none'),
    coalesce(t->>'reminder_time', '09:00'),
    coalesce((t->>'sort_order')::int, 0)
  from jsonb_array_elements(coalesce(payload->'tasks', '[]'::jsonb)) t;

  insert into public.task_occurrences (task_id, owner_id, date)
  select (o->>'task_id')::uuid, uid, (o->>'date')::date
  from jsonb_array_elements(coalesce(payload->'completions', '[]'::jsonb)) o
  on conflict (task_id, date) do nothing;
end $$;

revoke all on function public.restore_backup(jsonb) from public, anon;
grant execute on function public.restore_backup(jsonb) to authenticated;
