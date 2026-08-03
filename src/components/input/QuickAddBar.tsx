"use client";

import { useRef, useState } from "react";
import { toneOf } from "@/domain/palette";
import { formatDayShort } from "@/domain/date";
import type { Category, ISODate } from "@/domain/types";

interface Props {
  date: ISODate;
  isToday: boolean;
  categories: Category[];
  /** 마지막으로 사용한 카테고리. 기본 선택값이 된다 */
  categoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  onSubmit: (title: string) => void;
  onOpenDetail: (title: string) => void;
}

/**
 * 한 줄 추가 바 — E1. 이 앱에서 가장 중요한 장치.
 *
 * 이탈 1순위가 "적는 게 귀찮아짐"이었다 (03-scenarios S5-b).
 * 그래서 3탭을 1탭으로 줄인다:
 *   - 제목 외 모든 필드에 기본값이 채워져 있다
 *   - Enter 하나로 저장하고, 저장 후에도 닫히지 않아 연속 입력이 된다
 *   - 기간·매일 체크 같은 복잡한 선택지는 [⋯] 뒤로 접어둔다 (P5)
 */
export function QuickAddBar({
  date,
  isToday,
  categories,
  categoryId,
  onCategoryChange,
  onSubmit,
  onOpenDetail,
}: Props) {
  const [title, setTitle] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const value = title.trim();
    // 빈 입력은 아무 일도 일어나지 않는다. 에러 메시지도 띄우지 않는다
    if (value === "") return;
    onSubmit(value);
    setTitle("");
    // 입력창을 닫지 않고 커서를 유지한다 — 연속 입력
    inputRef.current?.focus();
  }

  const placeholder = isToday ? "할일 추가…" : `${formatDayShort(date)}에 추가…`;

  return (
    <div className="sticky bottom-0 flex-none border-t border-line bg-surface pb-[max(9px,env(safe-area-inset-bottom))]">
      {focused && categories.length > 0 && (
        <div className="flex gap-[6px] overflow-x-auto px-[13px] pb-[2px] pt-[8px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const on = c.id === categoryId;
            const tone = toneOf(c.color);
            return (
              <button
                key={c.id}
                type="button"
                // 포커스가 입력창에서 빠져나가면 칩이 사라져 탭이 먹히지 않는다
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCategoryChange(c.id);
                  inputRef.current?.focus();
                }}
                aria-pressed={on}
                className="shrink-0 whitespace-nowrap rounded-full px-[10px] py-[4px] text-[11px] font-medium"
                style={
                  on
                    ? { background: tone.bg, color: tone.tx, outline: `1.5px solid ${tone.dt}` }
                    : { background: "var(--line-2)", color: "var(--ink-3)" }
                }
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-[9px] px-[13px] py-[9px]">
        <span aria-hidden className="text-[15px] text-ink-3">
          ✎
        </span>
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // 한글 조합 중의 Enter는 확정용이다. 이걸 저장으로 받으면 중복 저장된다.
            // E1의 성패가 이 한 줄에 달려 있다 (04-engagement E1 엣지 케이스)
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            submit();
          }}
          placeholder={placeholder}
          aria-label="할일 추가"
          enterKeyHint="done"
          // 자동 대문자·자동수정은 할일 제목에 방해만 된다
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // 글자 크기는 globals.css가 터치 기기에서 16px로 올린다 (iOS 자동 확대 방지)
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onOpenDetail(title.trim())}
          aria-label="자세히 입력"
          className="px-1 text-[15px] text-ink-3"
        >
          ⋯
        </button>
      </div>
    </div>
  );
}
