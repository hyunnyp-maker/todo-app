-- 06-architecture.md 3.1
-- 적용 완료 (2026-08-03)

-- ── 카테고리 ────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  -- 기본값을 auth.uid()로 두면 클라이언트가 owner_id를 보낼 일이 없다.
  -- 남의 id를 지정해 넣는 경로 자체가 사라진다
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 20),
  color       text not null,          -- 팔레트 키: 'sage' | 'mist' | ...
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ── 할일 ────────────────────────────────────
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- 카테고리를 지워도 할일은 살아남아 null(미분류)이 된다. 삭제 정책이 DB에서 보장된다
  category_id     uuid references public.categories(id) on delete set null,
  title           text not null check (char_length(title) between 1 and 200),
  memo            text,
  start_date      date not null,
  end_date        date not null,
  check_mode      text not null default 'once' check (check_mode in ('once','daily')),
  done            boolean not null default false,
  completed_dates date[] not null default '{}',
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint valid_range check (end_date >= start_date)
);

-- ── 인덱스 ──────────────────────────────────
-- 달력은 "표시 중인 그리드 범위"만 조회한다 (요구사항 6.1)
create index if not exists tasks_owner_range_idx
  on public.tasks (owner_id, start_date, end_date);
create index if not exists categories_owner_idx
  on public.categories (owner_id, sort_order);

-- ── RLS ─────────────────────────────────────
alter table public.categories enable row level security;
alter table public.tasks      enable row level security;

-- (select auth.uid()) 로 감싸는 이유:
--   그냥 auth.uid()로 쓰면 행마다 재평가된다. 감싸면 쿼리당 한 번만 계산돼
--   할일이 쌓여도 조회가 느려지지 않는다.
-- to authenticated:
--   익명 역할에는 정책 평가 자체를 돌리지 않는다.
drop policy if exists "own categories" on public.categories;
create policy "own categories" on public.categories
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "own tasks" on public.tasks;
create policy "own tasks" on public.tasks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- v2 확장 지점 —
--   위 두 정책에 or exists (select 1 from category_shares s where ...) 를 더하면
--   카테고리 단위 공유가 열린다. 클라이언트 코드는 바뀌지 않는다.

-- ── updated_at 자동 갱신 ─────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''      -- 검색 경로를 통한 권한 상승 경로를 막는다
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tasks_touch on public.tasks;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
