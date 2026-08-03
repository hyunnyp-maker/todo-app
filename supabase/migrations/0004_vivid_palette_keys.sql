-- 적용 완료 (2026-08-03)
--
-- 팔레트를 뮤트 파스텔에서 비비드 원색으로 교체했다.
-- 이미 저장된 카테고리의 옛 키를 새 키로 옮긴다.
-- 클라이언트도 읽는 시점에 같은 변환을 하지만(normalizePaletteKey),
-- DB에도 반영해 두 곳이 어긋나지 않게 한다.

update public.categories set color = case color
  when 'sage'     then 'green'
  when 'olive'    then 'green'
  when 'teal'     then 'blue'
  when 'mist'     then 'blue'
  when 'slate'    then 'ink'
  when 'lavender' then 'purple'
  when 'plum'     then 'purple'
  when 'rose'     then 'pink'
  when 'coral'    then 'red'
  when 'clay'     then 'orange'
  when 'sand'     then 'brown'
  when 'mustard'  then 'yellow'
  else color
end
where color in ('sage','olive','teal','mist','slate','lavender',
                'plum','rose','coral','clay','sand','mustard');

-- 가입 시 기본 카테고리 3개도 새 키로.
-- 차트의 의미를 따랐다 — 직장=신뢰, 개인=회복, 가족=따뜻함
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (owner_id, name, color, sort_order)
  values
    (new.id, '직장', 'blue',   0),
    (new.id, '개인', 'green',  1),
    (new.id, '가족', 'orange', 2);
  return new;
end $$;

revoke all on function public.seed_default_categories() from public, anon, authenticated;
