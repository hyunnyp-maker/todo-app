"use client";

interface Props {
  pending: number;
}

/**
 * 대기 중인 변경 표식 — 요구사항 3.5 규칙 6
 *
 * "저장했습니다" 토스트는 띄우지 않는다. 화면이 이미 바뀌었으니 사족이다.
 * 아직 서버에 못 간 게 있을 때만 조용히 알린다.
 */
export function SyncBadge({ pending }: Props) {
  if (pending === 0) return null;
  return (
    <span className="text-[11px] text-ink-3" aria-live="polite">
      동기화 대기 {pending}
    </span>
  );
}
