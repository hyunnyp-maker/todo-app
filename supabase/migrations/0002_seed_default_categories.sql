-- 요구사항 F6-3 — 최초 실행 시 기본 카테고리 3개
-- 적용 완료 (2026-08-03)
--
-- 게스트 모드는 localStorage 시딩(src/data/local/seed.ts)이 처리하지만
-- 로그인 모드에는 그게 없어서, 가입한 사용자가 빈 밴드를 마주하고 직접 다 만들어야 했다.
--
-- 클라이언트에서 "카테고리가 0개면 만들기"로 처리하지 않는 이유:
--   사용자가 마지막 카테고리를 일부러 지웠을 때 계속 되살아난다.
--   요구사항 4.3은 "마지막 카테고리도 삭제할 수 있고 빈 상태가 된다"고 정했다.
-- 그래서 가입 시점에 딱 한 번만 만든다.

create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer      -- 트리거 실행 중에는 세션이 없어 RLS를 통과해야 한다
set search_path = ''
as $$
begin
  insert into public.categories (owner_id, name, color, sort_order)
  values
    (new.id, '직장', 'mist',  0),
    (new.id, '개인', 'sage',  1),
    (new.id, '가족', 'clay',  2);
  return new;
end $$;

-- 트리거 전용 함수다. REST API(/rest/v1/rpc/...)로 직접 호출될 이유가 없고,
-- SECURITY DEFINER라 남이 부를 수 있으면 임의의 owner_id로 행을 만들 여지가 생긴다.
revoke all on function public.seed_default_categories() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.seed_default_categories();
