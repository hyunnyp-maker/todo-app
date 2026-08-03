"use client";

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
  const taken = new Set(used);
  const ordered = [
    ...PALETTE_KEYS.filter((k) => !taken.has(k)),
    ...PALETTE_KEYS.filter((k) => taken.has(k)),
  ];

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
