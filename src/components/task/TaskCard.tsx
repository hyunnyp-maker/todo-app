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
        className="relative flex min-h-[62px] items-start gap-[10px] rounded-card border py-[11px] pl-3 pr-3"
        style={{
          // 카드는 무채색으로 두고 색은 좌측 6px 띠에만 쓴다.
          // 색 면적을 좁히면 원색을 써도 시끄럽지 않고, 시선은 제목에 먼저 간다
          background: "var(--card)",
          borderColor: "var(--card-border)",
          borderLeft: `6px solid ${tone.dt}`,
          boxShadow: "var(--card-shadow)",
          color: "var(--ink)",
          opacity: done ? 0.55 : 1,
          transform: `translateX(${offset}px)`,
          transition:
            offset === 0
              ? "transform 180ms var(--ease), opacity 250ms var(--ease)"
              : undefined,
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
          className="relative mt-[1px] flex size-[17px] shrink-0 items-center justify-center rounded-check border-2"
          style={{
            borderColor: done ? tone.dt : "var(--ink-3)",
            background: done ? tone.dt : "transparent",
            transition: "background 160ms var(--ease), border-color 160ms var(--ease)",
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
          {/* 제목이 화면에서 가장 진하다 — 시선이 할일 이름에 먼저 꽂혀야 한다 */}
          <div
            className="text-[13.5px] font-semibold leading-[1.35]"
            style={{
              textDecoration: done ? "line-through" : undefined,
              opacity: done ? 0.6 : 1,
              transition: "opacity 250ms var(--ease)",
            }}
          >
            {task.title}
          </div>
          {/* 카테고리 이름은 항상 노출한다 — 색만으로 구분하지 않기 위해 (요구사항 6.2) */}
          <div className="mt-[3px] flex flex-wrap gap-[8px] text-[10.5px] font-semibold">
            <span style={{ color: tone.tx }}>{categoryName}</span>
            {detail && (
              <span className="font-medium" style={{ color: "var(--ink-3)" }}>
                {detail}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
