"use client";

import { useMemo } from "react";
import { formatDaySlash } from "@/domain/date";
import { toneOf } from "@/domain/palette";
import { describeRecurrence } from "@/domain/recurrence";
import { isMultiDay, isTaskComplete } from "@/domain/task";
import type { Category, Task } from "@/domain/types";

interface Props {
  query: string;
  tasks: Task[];
  categories: Category[];
  isLoading: boolean;
  onOpen: (task: Task) => void;
}

/**
 * 검색 결과.
 *
 * 여기서는 체크박스를 두지 않는다.
 * 반복 일정은 "어느 회차를 끝냈는가"가 있어야 체크가 성립하는데,
 * 검색 결과에는 그 날짜가 없다. 탭하면 상세로 보내고 거기서 다루게 한다.
 */
export function SearchResults({
  query,
  tasks,
  categories,
  isLoading,
  onOpen,
}: Props) {
  const byId = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  if (isLoading) {
    return (
      <p className="px-6 py-7 text-center text-[12.5px] text-ink-3">찾는 중…</p>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="px-6 py-7 text-center text-[12.5px] leading-[1.6] text-ink-3">
        &lsquo;{query}&rsquo;와 맞는 할일이 없습니다.
      </p>
    );
  }

  return (
    <>
      <p className="px-[15px] pb-[5px] pt-[2px] text-[11px] text-ink-3">
        {tasks.length}개
      </p>
      <ul className="flex flex-col gap-[7px] px-3 pb-2">
        {tasks.map((task) => {
          const category = task.categoryId ? byId.get(task.categoryId) : undefined;
          const tone = toneOf(category?.color ?? null);
          const done = isTaskComplete(task);
          const when = task.recurrence
            ? describeRecurrence(task.recurrence)
            : isMultiDay(task)
              ? `${formatDaySlash(task.startDate)} – ${formatDaySlash(task.endDate)}`
              : formatDaySlash(task.startDate);

          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen(task)}
                className="flex min-h-[56px] w-full items-center gap-[10px] rounded-card border py-[11px] pl-3 pr-3 text-left"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--card-border)",
                  borderLeft: `6px solid ${tone.dt}`,
                  boxShadow: "var(--card-shadow)",
                  color: "var(--ink)",
                  opacity: done ? 0.55 : 1,
                }}
              >
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13.5px] font-semibold leading-[1.35]"
                    style={{ textDecoration: done ? "line-through" : undefined }}
                  >
                    {task.title}
                  </span>
                  <span className="mt-[3px] flex flex-wrap gap-[8px] text-[10.5px] font-semibold">
                    <span style={{ color: tone.tx }}>
                      {category?.name ?? "미분류"}
                    </span>
                    <span className="font-medium" style={{ color: "var(--ink-3)" }}>
                      {when}
                    </span>
                  </span>
                </span>
                <span aria-hidden className="shrink-0 text-[13px] text-ink-3">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
