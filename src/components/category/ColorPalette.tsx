"use client";

import { useState } from "react";
import {
  PALETTE_KEYS,
  PALETTE_LABELS,
  PALETTE_MEANINGS,
  toneOf,
} from "@/domain/palette";
import type { PaletteKey } from "@/domain/types";

interface Props {
  value: PaletteKey;
  /** 다른 카테고리가 이미 쓰고 있는 색 */
  used: readonly PaletteKey[];
  onChange: (color: PaletteKey) => void;
}

/**
 * 팔레트 — E4. 색 고르기가 이 앱의 즐거움이다.
 *
 * 자유 컬러피커를 두지 않는다 (P9). 선택 부담이 늘고 못생긴 색이 나온다.
 * 대신 참고 컬러 차트의 9색만 두고, 각 색의 성격(신뢰·회복·따뜻함…)을 함께 보여준다.
 */
export function ColorPalette({ value, used, onChange }: Props) {
  // 정렬 순서와 '사용 중' 표시를 열린 시점에 고정한다.
  //
  // 색을 고르면 즉시 미리보기가 실제 카테고리 색을 바꾸고, 그러면 '사용 중인 색' 목록이
  // 달라져 격자가 통째로 재배치된다. 방금 누른 색이 다른 자리로 튀어
  // 색을 비교하며 고르는 일이 불가능해진다 (03-scenarios S5).
  // 시트는 열 때마다 리마운트되므로 이 고정은 다음에 열 때 갱신된다.
  const [frozen] = useState(() => {
    const taken = new Set(used);
    return {
      taken,
      ordered: [
        ...PALETTE_KEYS.filter((k) => !taken.has(k)),
        ...PALETTE_KEYS.filter((k) => taken.has(k)),
      ],
    };
  });
  const { taken, ordered } = frozen;

  return (
    <div className="grid grid-cols-3 gap-[8px]">
      {ordered.map((key) => {
        const tone = toneOf(key);
        const selected = key === value;
        const inUse = taken.has(key) && !selected;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={`${PALETTE_LABELS[key]} — ${PALETTE_MEANINGS[key]}${
              inUse ? " (사용 중)" : ""
            }`}
            aria-pressed={selected}
            className="flex min-h-[52px] flex-col items-start justify-center gap-[5px] rounded-[10px] border px-[9px] py-[8px] text-left transition-colors"
            style={{
              background: selected ? tone.bg : "var(--line-2)",
              borderColor: selected ? tone.dt : "transparent",
              borderWidth: selected ? 2 : 1,
            }}
          >
            <span className="flex w-full items-center gap-[7px]">
              {/* 색상칩 — 이 색이 카테고리 뱃지와 카드 좌측 띠, 달력 점에 그대로 쓰인다.
                  가는 띠보다 채워진 원이 먼저 읽힌다 */}
              <span
                aria-hidden
                className="size-[16px] shrink-0 rounded-full"
                style={{
                  background: tone.dt,
                  boxShadow: selected ? `0 0 0 2px var(--surface), 0 0 0 3.5px ${tone.dt}` : undefined,
                }}
              />
              <span
                className="truncate text-[11.5px] font-semibold"
                style={{ color: selected ? tone.tx : "var(--ink-2)" }}
              >
                {PALETTE_LABELS[key]}
              </span>
              {inUse && (
                <span
                  aria-hidden
                  className="ml-auto text-[8px] leading-none"
                  style={{ color: "var(--ink-3)" }}
                >
                  ●
                </span>
              )}
            </span>
            <span
              className="truncate text-[9.5px] leading-none"
              style={{ color: "var(--ink-3)" }}
            >
              {PALETTE_MEANINGS[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
