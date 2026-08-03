"use client";

import { formatDayShort, weekdayKo } from "@/domain/date";
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
      aria-label={`${formatDayShort(date)} ${weekdayKo(date)}요일${
        isToday ? ", 오늘" : ""
      }, 할일 ${tasks.length}개`}
      aria-current={isToday ? "date" : undefined}
      aria-pressed={isSelected}
      // 42칸이 전부 탭 정지점이 되면 키보드 이동이 고문이 된다.
      // 선택된 칸만 포커스를 받고 그 안에서 화살표로 옮긴다
      tabIndex={isSelected ? 0 : -1}
      className={[
        // 셀 높이 34px는 44px 터치 타깃에 미달한다.
        // ::after 로 상하 여백까지 터치 영역에 포함시켜 실효 44px을 확보한다 (05-design 4.3)
        "relative flex h-[34px] flex-col items-center justify-start rounded-cell pt-[4px]",
        "text-[11px] leading-none transition-colors",
        "after:absolute after:inset-x-0 after:top-1/2 after:h-[44px] after:-translate-y-1/2 after:content-['']",
        // 넓은 화면에서는 셀을 키우고 제목까지 보여준다 (05-design 7)
        "md:h-[64px] md:items-stretch md:px-[4px] md:after:hidden",
        isToday ? "bg-ink font-bold text-white" : "",
        !isToday && isSelected ? "ring-[1.5px] ring-ink ring-inset" : "",
      ].join(" ")}
      style={{
        color: isToday ? undefined : inMonth ? "var(--ink-2)" : "#c8ccd1",
      }}
    >
      <span className="md:self-center">{day}</span>

      {/* 좁은 화면에서는 점으로, 넓은 화면에서는 아래 제목으로 대신한다 */}
      <span className="mt-[3px] flex h-[5px] items-center gap-[2px] md:hidden">
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

      {/* 768px 이상에서만: 점 대신 제목을 직접 읽는다 */}
      <span className="mt-[2px] hidden w-full flex-col gap-[1px] overflow-hidden md:flex">
        {marks.slice(0, 2).map((task) => {
          const tone = toneOf(
            task.categoryId ? categoryById.get(task.categoryId)?.color : null,
          );
          return (
            <span
              key={task.id}
              aria-hidden
              className="truncate rounded-[3px] px-[3px] py-[1px] text-left text-[9.5px] leading-[1.3]"
              style={{
                background: isToday ? "rgba(255,255,255,0.14)" : tone.bg,
                color: isToday ? "#fff" : tone.tx,
                opacity: isDoneOn(task, date) ? 0.45 : 1,
              }}
            >
              {task.title}
            </span>
          );
        })}
      </span>
    </button>
  );
}
