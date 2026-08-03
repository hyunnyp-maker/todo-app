"use client";

import { useState } from "react";
import { PALETTE_KEYS, PALETTE_LABELS, toneOf } from "@/domain/palette";
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
 * 아직 안 쓴 색을 앞에 놓아, 위에서부터 고르면 자연히 겹치지 않는다.
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
    <div className="grid grid-cols-6 gap-[8px]">
      {ordered.map((key) => {
        const tone = toneOf(key);
        const selected = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-label={`${PALETTE_LABELS[key]}${taken.has(key) && !selected ? " (사용 중)" : ""}`}
            aria-pressed={selected}
            className="relative flex h-[44px] items-center justify-center rounded-[10px]"
            style={{
              background: tone.bg,
              outline: selected ? `2px solid ${tone.dt}` : "none",
              outlineOffset: "-2px",
            }}
          >
            <span
              aria-hidden
              className="size-[12px] rounded-full"
              style={{ background: tone.dt }}
            />
            {taken.has(key) && !selected && (
              <span
                aria-hidden
                className="absolute bottom-[4px] text-[8px] leading-none"
                style={{ color: tone.tx, opacity: 0.5 }}
              >
                ●
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
