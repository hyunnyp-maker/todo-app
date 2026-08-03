"use client";

import { useMemo, useRef } from "react";
import { addDays, buildMonthGrid, WEEKDAY_LABELS } from "@/domain/date";
import { buildDateIndex, sortTasksForDate } from "@/domain/task";
import type { Category, ISODate, ISOMonth, Task } from "@/domain/types";
import { CalendarCell } from "./CalendarCell";

interface Props {
  month: ISOMonth;
  today: ISODate;
  selectedDate: ISODate;
  tasks: Task[];
  categories: Category[];
  onSelect: (date: ISODate) => void;
  onShiftMonth: (delta: number) => void;
}

const SWIPE_THRESHOLD = 48;

export function MonthCalendar({
  month,
  today,
  selectedDate,
  tasks,
  categories,
  onSelect,
  onShiftMonth,
}: Props) {
  const grid = useMemo(() => buildMonthGrid(month), [month]);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  // 42칸마다 filter를 돌리지 않도록 한 번만 인덱싱한다
  const byDate = useMemo(() => buildDateIndex(tasks), [tasks]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  /** 키보드로 달력을 오갈 수 있어야 한다 (05-design 8) */
  function handleKeyDown(e: React.KeyboardEvent) {
    const delta =
      e.key === "ArrowLeft"
        ? -1
        : e.key === "ArrowRight"
          ? 1
          : e.key === "ArrowUp"
            ? -7
            : e.key === "ArrowDown"
              ? 7
              : 0;
    if (delta === 0) return;
    e.preventDefault();
    onSelect(addDays(selectedDate, delta));
  }

  return (
    <section
      aria-label="월간 달력"
      onKeyDown={handleKeyDown}
      className="px-[11px] select-none lg:px-0"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStart.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = t.clientY - start.y;
        // 세로 스크롤과 헷갈리지 않게 가로 이동이 확실히 클 때만
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
          onShiftMonth(dx < 0 ? 1 : -1);
        }
      }}
    >
      <div className="grid grid-cols-7 pb-[3px] text-center text-[10px] text-ink-3">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px">
        {grid.flat().map((date) => {
          const dayTasks = sortTasksForDate(
            byDate.get(date) ?? [],
            date,
            categories,
          );
          return (
            <CalendarCell
              key={date}
              date={date}
              inMonth={date.startsWith(month)}
              isToday={date === today}
              isSelected={date === selectedDate}
              tasks={dayTasks}
              categoryById={categoryById}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </section>
  );
}
