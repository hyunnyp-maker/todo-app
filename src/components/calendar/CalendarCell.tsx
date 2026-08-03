"use client";

import { formatDayShort, weekdayKo } from "@/domain/date";
import { toneOf } from "@/domain/palette";
import { EMPTY_COMPLETIONS, type CompletionSet } from "@/domain/recurrence";
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
  completions?: CompletionSet;
  onSelect: (date: ISODate) => void;
}

export function CalendarCell({
  date,
  inMonth,
  isToday,
  isSelected,
  tasks,
  categoryById,
  completions = EMPTY_COMPLETIONS,
  onSelect,
}: Props) {
  const marks = tasks.slice(0, MAX_MARKS);
  const overflow = tasks.length - marks.length;
  const day = Number(date.slice(8));

  // 넓은 화면(md+)에서는 하루짜리만 제목으로 읽고, 기간형은 좁은 화면과 똑같이 막대로 잇는다.
  // 기간형까지 제목으로 쓰면 29일짜리 할일 하나가 달력 전체를 같은 문구로 덮는다.
  const spans = marks.filter(isMultiDay);
  const singles = marks.filter((task) => !isMultiDay(task));

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
        // 넓은 화면에서는 셀을 키우고 제목까지 보여준다 (05-design 7).
        //
        // min-h-0이 핵심이다. 그리드 아이템의 기본값 min-height:auto는
        // 내용보다 작아지는 것을 막아 h-[76px]를 무시한다.
        // 그러면 할일이 많은 칸만 세로로 늘어나 격자가 들쭉날쭉해진다.
        "md:h-[76px] md:min-h-0 md:items-stretch md:justify-start md:overflow-hidden md:px-[4px] md:pb-[3px] md:after:hidden",
        isToday ? "bg-ink font-bold text-white" : "",
        !isToday && isSelected ? "ring-[1.5px] ring-ink ring-inset" : "",
      ].join(" ")}
      style={{
        color: isToday ? undefined : inMonth ? "var(--ink-2)" : "#c8ccd1",
      }}
    >
      <span className="md:self-center">{day}</span>

      {/* 좁은 화면: 하루짜리는 점, 기간형은 막대 — 전부 한 줄에 */}
      <span className="mt-[3px] flex h-[5px] items-center gap-[2px] md:hidden">
        {marks.map((task) => {
          const tone = toneOf(
            task.categoryId ? categoryById.get(task.categoryId)?.color : null,
          );
          const dimmed = isDoneOn(task, date, completions);
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

      {/* 768px 이상 ─────────────────────────────────
          기간형은 막대를 그대로 유지한다. 며칠에 걸쳐 이어지는 형태 자체가 정보라서,
          날짜마다 같은 제목을 반복하면 정보가 늘지 않고 화면만 시끄러워진다. */}
      <span className="mt-[3px] hidden w-full flex-col gap-[2px] md:flex">
        {spans.map((task) => {
          const tone = toneOf(
            task.categoryId ? categoryById.get(task.categoryId)?.color : null,
          );
          return (
            <span
              key={task.id}
              aria-hidden
              className="h-[4px] w-full rounded-[2px]"
              style={{
                background: isToday ? "#ffffff" : tone.dt,
                opacity: isDoneOn(task, date, completions) ? 0.35 : 1,
              }}
            />
          );
        })}
      </span>

      {/* 하루짜리만 제목으로 읽는다 */}
      <span className="mt-[2px] hidden w-full flex-col gap-[1px] md:flex">
        {singles.slice(0, 2).map((task) => {
          const tone = toneOf(
            task.categoryId ? categoryById.get(task.categoryId)?.color : null,
          );
          return (
            <span
              key={task.id}
              aria-hidden
              className="truncate rounded-[3px] px-[3px] py-[1px] text-left text-[9.5px] leading-[1.3]"
              style={{
                background: isToday ? "rgba(255,255,255,0.16)" : tone.bg,
                color: isToday ? "#fff" : tone.tx,
                opacity: isDoneOn(task, date, completions) ? 0.45 : 1,
              }}
            >
              {task.title}
            </span>
          );
        })}
        {overflow > 0 && (
          <span
            aria-hidden
            className="px-[3px] text-left text-[8.5px] leading-[1.3]"
            style={{ color: isToday ? "rgba(255,255,255,0.7)" : "var(--ink-3)" }}
          >
            +{overflow}
          </span>
        )}
      </span>
    </button>
  );
}
