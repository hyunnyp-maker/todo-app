-- 적용 완료 (2026-08-03)
--
-- 외래키에 커버링 인덱스가 없으면 카테고리를 지울 때마다 tasks 전체를 훑어
-- 참조를 찾는다. orphan(ON DELETE SET NULL)과 cascade 삭제 양쪽 모두 해당된다.
--
-- Supabase 진단이 곧바로 "쓰이지 않는 인덱스"로 표시하는데, 정상이다.
-- 카테고리를 삭제해 봐야 쓰이기 때문이다.

create index if not exists tasks_category_idx on public.tasks (category_id);
