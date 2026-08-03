/**
 * 아이콘 — 라이브러리를 넣지 않고 필요한 것만 직접 그린다.
 *
 * 문자 글리프(⌕ ⚙)를 쓰다가 SVG로 바꾼 이유:
 * ⌕(U+2315)는 폰트마다 크기가 제각각이고 대부분 글자보다 작게 그려져,
 * font-size를 올려도 눈에 띄게 커지지 않는다. 설정의 ⚙도 톱니가 뭉개진다.
 *
 * currentColor를 쓰므로 색은 부모의 text-* 로 정한다.
 */

interface IconProps {
  /** 픽셀 크기. 기본 22 */
  size?: number;
}

/** 돋보기 */
export function SearchIcon({ size = 22 }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4 20 20" />
    </svg>
  );
}

/** 설정 — 톱니바퀴 대신 슬라이더. 형태가 단순해 작은 크기에서도 뭉개지지 않는다 */
export function SettingsIcon({ size = 22 }: IconProps) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
      <circle cx="16" cy="8" r="2.2" fill="var(--surface)" />
      <circle cx="10" cy="16" r="2.2" fill="var(--surface)" />
    </svg>
  );
}
