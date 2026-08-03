"use client";

import { useRef, useState } from "react";

interface Props {
  /** debounce를 거친 값이 올라온다 */
  onQueryChange: (query: string) => void;
  onClose: () => void;
}

/** 타자 한 번에 한 번씩 조회하면 한글 한 글자에 세 번 나간다 */
const DEBOUNCE_MS = 200;

/**
 * 검색 입력.
 *
 * 값은 두 벌로 둔다 — 화면에 보이는 것(즉시)과 조회에 쓰는 것(지연).
 * 하나로 합치면 글자를 칠 때마다 입력이 한 박자씩 밀린다.
 */
export function SearchBar({ onQueryChange, onClose }: Props) {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function push(value: string, immediate = false) {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    if (immediate) {
      onQueryChange(value);
      return;
    }
    timer.current = setTimeout(() => onQueryChange(value), DEBOUNCE_MS);
  }

  function clear() {
    push("", true);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-none items-center gap-[8px] px-[15px] pb-[6px] lg:px-0">
      <div
        className="flex min-h-[44px] flex-1 items-center gap-[8px] rounded-[12px] px-[12px]"
        style={{ background: "var(--line-2)" }}
      >
        <span aria-hidden className="text-[13px] text-ink-3">
          ⌕
        </span>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => push(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
          autoFocus
          type="search"
          aria-label="할일 제목 검색"
          placeholder="할일 제목 검색…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // 글자 크기는 globals.css가 터치 기기에서 16px로 올린다 (iOS 자동 확대 방지)
          className="min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold outline-none placeholder:font-normal placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
        />
        {text !== "" && (
          <button
            type="button"
            onClick={clear}
            aria-label="검색어 지우기"
            className="px-[4px] text-[13px] text-ink-3"
          >
            ✕
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="min-h-[44px] shrink-0 px-[4px] text-[12.5px] text-ink-2"
      >
        취소
      </button>
    </div>
  );
}
