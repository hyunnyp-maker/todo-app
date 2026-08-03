"use client";

import { useRef, useState } from "react";
import { toneOf } from "@/domain/palette";
import { isDoneOn, taskDetailText } from "@/domain/task";
import type { Category, ISODate, Task } from "@/domain/types";

interface Props {
  task: Task;
  category: Category | null;
  on: ISODate;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  onRequestDelete: (task: Task) => void;
}

const SWIPE_REVEAL = 76;
const SWIPE_TRIGGER = 56;

export function TaskCard({
  task,
  category,
  on,
  onToggle,
  onOpen,
  onRequestDelete,
}: Props) {
  const tone = toneOf(category?.color ?? null);
  const done = isDoneOn(task, on);
  const detail = taskDetailText(task, on);
  const categoryName = category?.name ?? "미분류";

  const [spreadKey, setSpreadKey] = useState(0);
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const swiping = useRef(false);

  function handleToggle() {
    // 체크로 "완료가 되는" 순간에만 번짐을 재생한다. 해제할 때는 조용히
    if (!done) setSpreadKey((k) => k + 1);
    onToggle(task);
  }

  return (
    <div className="relative overflow-hidden rounded-card">
      {/* 스와이프로 드러나는 삭제 영역.
          끌고 있을 때만 그린다 — 완료된 카드는 opacity가 낮아
          항상 깔려 있으면 아래의 '삭제'가 비쳐 보인다 */}
      {offset < 0 && (
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 flex w-[76px] items-center justify-center text-[12px] font-medium"
          style={{ color: "var(--danger)", background: "var(--line-2)" }}
        >
          삭제
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (Math.abs(offset) > 4) return; // 스와이프 직후의 클릭은 무시
          onOpen(task);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(task);
          }
        }}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
          swiping.current = false;
        }}
        onTouchMove={(e) => {
          if (startX.current === null) return;
          const dx = e.touches[0].clientX - startX.current;
          if (dx < -6) swiping.current = true;
          if (swiping.current) setOffset(Math.max(-SWIPE_REVEAL, Math.min(0, dx)));
        }}
        onTouchEnd={() => {
          startX.current = null;
          if (offset <= -SWIPE_TRIGGER) {
            setOffset(0);
            onRequestDelete(task);
          } else {
            setOffset(0);
          }
        }}
        className="relative flex min-h-[62px] items-start gap-[9px] rounded-card px-3 py-[10px]"
        style={{
          background: tone.bg,
          color: tone.tx,
          opacity: done ? 0.62 : 1,
          transform: `translateX(${offset}px)`,
          transition: offset === 0 ? "transform 180ms var(--ease), opacity 250ms var(--ease)" : undefined,
        }}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${categoryName} · ${task.title}${done ? " · 완료됨" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          className="relative mt-[1px] flex size-[16px] shrink-0 items-center justify-center rounded-check border-[1.6px] border-current"
          style={{
            background: done ? "currentColor" : "transparent",
            opacity: done ? 0.85 : 0.5,
            transition: "background 160ms var(--ease), opacity 160ms var(--ease)",
          }}
        >
          {spreadKey > 0 && (
            <span
              key={spreadKey}
              aria-hidden
              className="check-spread pointer-events-none absolute size-[120px] rounded-full"
              style={{ background: tone.dt }}
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div
            className="text-[13.5px] font-medium leading-[1.35]"
            style={{
              textDecoration: done ? "line-through" : undefined,
              opacity: done ? 0.5 : 1,
              transition: "opacity 250ms var(--ease)",
            }}
          >
            {task.title}
          </div>
          {/* 카테고리 이름은 항상 노출한다 — 색만으로 구분하지 않기 위해 (요구사항 6.2) */}
          <div className="mt-[3px] flex flex-wrap gap-[7px] text-[10.5px] opacity-[0.72]">
            <span>{categoryName}</span>
            {detail && <span>{detail}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
