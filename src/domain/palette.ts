/**
 * 팔레트 — 05-design.md 2.2
 *
 * 각 색은 배경 / 텍스트 / 마크 3단계 세트다.
 * hex는 globals.css의 CSS 변수가 진실의 원천이고, 여기서는 var() 참조만 만든다.
 * 색을 바꿀 때 CSS 한 곳만 고치면 되도록.
 */

import type { PaletteKey } from "./types";

export interface ToneSet {
  /** 카드 배경 */
  bg: string;
  /** 카드 텍스트 */
  tx: string;
  /** 달력 점·기간 막대 */
  dt: string;
}

export const PALETTE_KEYS: readonly PaletteKey[] = [
  "sage",
  "rose",
  "mist",
  "lavender",
  "clay",
  "mustard",
  "olive",
  "teal",
  "plum",
  "sand",
  "slate",
  "coral",
] as const;

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  sage: "세이지",
  rose: "더스티 로즈",
  mist: "미스트 블루",
  lavender: "라벤더",
  clay: "클레이",
  mustard: "머스터드",
  olive: "올리브",
  teal: "티일",
  plum: "플럼",
  sand: "샌드",
  slate: "슬레이트",
  coral: "코랄",
};

/** 기본 카테고리 배정 — 색상환에서 서로 멀어 작은 점으로도 구분된다 */
export const DEFAULT_CATEGORY_COLORS = {
  work: "mist",
  personal: "sage",
  family: "clay",
} as const satisfies Record<string, PaletteKey>;

/** 미분류 — 실제 카테고리가 아니므로 팔레트 색을 배정하지 않는다 */
export const UNCATEGORIZED_TONE: ToneSet = {
  bg: "var(--none-bg)",
  tx: "var(--none-tx)",
  dt: "var(--none-dt)",
};

export function toneOf(color: PaletteKey | null | undefined): ToneSet {
  if (!color) return UNCATEGORIZED_TONE;
  return {
    bg: `var(--${color}-bg)`,
    tx: `var(--${color}-tx)`,
    dt: `var(--${color}-dt)`,
  };
}

export function isPaletteKey(value: unknown): value is PaletteKey {
  return (
    typeof value === "string" &&
    (PALETTE_KEYS as readonly string[]).includes(value)
  );
}

/**
 * 아직 안 쓴 색을 먼저 돌려준다 (05-design 5.8).
 * 새 카테고리는 이 목록의 첫 색으로 시작해, 고르지 않아도 예쁘게 시작된다.
 */
export function unusedColors(used: readonly PaletteKey[]): PaletteKey[] {
  const taken = new Set(used);
  return PALETTE_KEYS.filter((key) => !taken.has(key));
}

/** 미사용 색 우선, 없으면 사용 중인 색 중 가장 적게 쓰인 것 */
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
