"use client";

import { toneOf } from "@/domain/palette";
import { isDoneOn, isMultiDay } from "@/domain/task";
import type { Category, ISODate, Task } from "@/domain/types";

/** 셀에 찍을 수 있는 마크 최대 개수. 넘치면 +N (05-design 4.3) */
export const MAX_MARKS = 3;

interface Props {
  date: ISODate;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  tasks: Task[];
  categoryById: Map<string, Category>;
  onSelect: (date: ISODate) => void;
}

export function CalendarCell({
  date,
  inMonth,
  isToday,
  isSelected,
  tasks,
  categoryById,
  onSelect,
}: Props) {
  const marks = tasks.slice(0, MAX_MARKS);
  const overflow = tasks.length - marks.length;
  const day = Number(date.slice(8));

  return (
    <button
      type="button"
      onClick={() => onSelect(date)}
      aria-label={`${date} 할일 ${tasks.length}개`}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isSelected}
      className={[
        // 셀 높이 34px는 44px 터치 타깃에 미달한다.
        // ::after 로 상하 여백까지 터치 영역에 포함시켜 실효 44px을 확보한다 (05-design 4.3)
        "relative flex h-[34px] flex-col items-center justify-start rounded-cell pt-[4px]",
        "text-[11px] leading-none transition-colors",
        "after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']",
        isToday ? "bg-ink font-bold text-white" : "",
        !isToday && isSelected ? "ring-[1.5px] ring-ink ring-inset" : "",
      ].join(" ")}
      style={{
        color: isToday ? undefined : inMonth ? "var(--ink-2)" : "#c8ccd1",
      }}
    >
      <span>{day}</span>

      <span className="mt-[3px] flex h-[5px] items-center gap-[2px]">
        {marks.map((task) => {
          const tone = toneOf(
            task.categoryId ? categoryById.get(task.categoryId)?.color : null,
          );
          const dimmed = isDoneOn(task, date);
          const color = isToday ? "#ffffff" : tone.dt;

          // 여러 날 할일은 점이 아니라 막대로 — 기간이라는 것을 형태로 알린다
          return isMultiDay(task) ? (
            <span
              key={task.id}
              aria-hidden
              className="h-[4px] w-[9px] rounded-[2px]"
              style={{ background: color, opacity: dimmed ? 0.35 : 1 }}
            />
          ) : (
            <span
              key={task.id}
              aria-hidden
              className="size-[4.5px] rounded-full"
              style={{ background: color, opacity: dimmed ? 0.35 : 1 }}
            />
          );
        })}
        {overflow > 0 && (
          <span
            aria-hidden
            className="text-[8px] leading-none"
            style={{ color: isToday ? "#ffffff" : "var(--ink-3)" }}
          >
            +{overflow}
          </span>
        )}
      </span>
    </button>
  );
}
