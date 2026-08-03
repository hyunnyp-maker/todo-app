/**
 * 팔레트 — 비비드 9색 (docs/mockups/themes.html)
 *
 * 파스텔에서 원색으로 바꾼 이유: 파스텔은 카드 배경이 전부 명도 92~96% 구간에 몰려
 * 색상만 다르고 밝기가 같았다. 눈은 그것을 "다른 것"이 아니라 "같은 것"으로 읽는다.
 *
 * 각 색은 세 값을 갖는다.
 *   dt  원색 — 좌측 띠 · 달력 점 · 기간 막대
 *   tx  라벨 텍스트 — 배경 위에서 4.5:1을 넘도록 조정한 값
 *   bg  옅은 배경 — 칩 등 좁은 면적
 *
 * 실제 hex는 globals.css의 CSS 변수가 진실의 원천이고, 여기서는 var() 참조만 만든다.
 * 라이트/다크 테마는 같은 변수 이름에 다른 값을 넣는 것으로 갈린다.
 */

import type { PaletteKey } from "./types";

export interface ToneSet {
  /** 옅은 배경 (칩) */
  bg: string;
  /** 라벨 텍스트 */
  tx: string;
  /** 원색 — 좌측 띠 · 점 · 막대 */
  dt: string;
  /**
   * 색을 꽉 채운 칩의 배경. 항상 흰 글자를 얹는 전제로 명도를 낮춘 값이다.
   * dt를 그대로 채우면 흰 글자가 노랑 위에서 1.5:1이 되어 사라진다.
   */
  cp: string;
}

export const PALETTE_KEYS: readonly PaletteKey[] = [
  "blue",
  "green",
  "orange",
  "red",
  "purple",
  "pink",
  "yellow",
  "brown",
  "ink",
] as const;

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  red: "레드",
  orange: "오렌지",
  yellow: "옐로",
  green: "그린",
  blue: "블루",
  pink: "핑크",
  purple: "퍼플",
  brown: "브라운",
  ink: "블랙",
};

/** 참고 컬러 차트의 키워드. 색을 고를 때 성격을 함께 보여준다 */
export const PALETTE_MEANINGS: Record<PaletteKey, string> = {
  red: "열정 · 긴급",
  orange: "따뜻함 · 사교",
  yellow: "창의 · 명랑",
  green: "회복 · 성장",
  blue: "신뢰 · 유능",
  pink: "공감 · 다정",
  purple: "품격 · 몰입",
  brown: "듬직 · 실용",
  ink: "격식 · 집중",
};

/**
 * 기본 카테고리 배정 — 차트의 의미를 그대로 따랐다.
 * 색상환에서 서로 멀어 작은 점으로도 구분된다.
 */
export const DEFAULT_CATEGORY_COLORS = {
  work: "blue",
  personal: "green",
  family: "orange",
} as const satisfies Record<string, PaletteKey>;

/**
 * 파스텔 시절의 키를 새 키로 옮긴다.
 * 이미 저장된 카테고리 색이 사라지면 안 되므로, 읽을 때 조용히 갈아끼운다.
 */
const LEGACY_KEYS: Record<string, PaletteKey> = {
  sage: "green",
  olive: "green",
  teal: "blue",
  mist: "blue",
  slate: "ink",
  lavender: "purple",
  plum: "purple",
  rose: "pink",
  coral: "red",
  clay: "orange",
  sand: "brown",
  mustard: "yellow",
};

export function isPaletteKey(value: unknown): value is PaletteKey {
  return (
    typeof value === "string" && (PALETTE_KEYS as readonly string[]).includes(value)
  );
}

/** 알 수 없는 값이면 null. 옛 키는 새 키로 바꿔서 돌려준다 */
export function normalizePaletteKey(value: unknown): PaletteKey | null {
  if (isPaletteKey(value)) return value;
  if (typeof value === "string" && value in LEGACY_KEYS) return LEGACY_KEYS[value];
  return null;
}

/** 미분류 — 실제 카테고리가 아니므로 팔레트 색을 배정하지 않는다 */
export const UNCATEGORIZED_TONE: ToneSet = {
  bg: "var(--none-bg)",
  tx: "var(--none-tx)",
  dt: "var(--none-dt)",
  cp: "var(--none-cp)",
};

export function toneOf(color: PaletteKey | null | undefined): ToneSet {
  if (!color) return UNCATEGORIZED_TONE;
  return {
    bg: `var(--${color}-bg)`,
    tx: `var(--${color}-tx)`,
    dt: `var(--${color}-dt)`,
    cp: `var(--${color}-cp)`,
  };
}

/**
 * 아직 안 쓴 색을 먼저 돌려준다.
 * 새 카테고리는 이 목록의 첫 색으로 시작해, 고르지 않아도 겹치지 않는다.
 */
export function unusedColors(used: readonly PaletteKey[]): PaletteKey[] {
  const taken = new Set(used);
  return PALETTE_KEYS.filter((key) => !taken.has(key));
}

/** 미사용 색 우선, 없으면 가장 적게 쓰인 색 */
export function suggestColor(used: readonly PaletteKey[]): PaletteKey {
  const unused = unusedColors(used);
  if (unused.length > 0) return unused[0];

  const count = new Map<PaletteKey, number>();
  for (const key of PALETTE_KEYS) count.set(key, 0);
  for (const key of used) count.set(key, (count.get(key) ?? 0) + 1);

  let best: PaletteKey = PALETTE_KEYS[0];
  for (const key of PALETTE_KEYS) {
    if ((count.get(key) ?? 0) < (count.get(best) ?? 0)) best = key;
  }
  return best;
}
