"use client";

import { useMemo } from "react";
import { sortTasksForDate, tasksOnDate } from "@/domain/task";
import type { Category, ISODate, Task } from "@/domain/types";
import { TaskCard } from "./TaskCard";

interface Props {
  date: ISODate;
  tasks: Task[];
  categories: Category[];
  hasAnyTask: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  onRequestDelete: (task: Task) => void;
}

export function TaskList({
  date,
  tasks,
  categories,
  hasAnyTask,
  onToggle,
  onOpen,
  onRequestDelete,
}: Props) {
  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const list = useMemo(
    () => sortTasksForDate(tasksOnDate(tasks, date), date, categories),
    [tasks, date, categories],
  );

  if (list.length === 0) {
    // 첫 실행에는 앱의 성격을 한 줄로 전달하고, 평소 빈 날짜는 조용히 넘어간다 (P12)
    return (
      <div className="px-6 py-7 text-center text-[12.5px] leading-[1.6] text-ink-3">
        {hasAnyTask ? (
          "할 일 없음"
        ) : (
          <>
            할 일을 아래에 적어보세요.
            <br />
            카테고리 색으로 직장·개인·가족이 한눈에 나뉩니다.
          </>
        )}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-[7px] px-3 pb-2">
      {list.map((task) => (
        <li key={task.id}>
          <TaskCard
            task={task}
            category={task.categoryId ? categoryById.get(task.categoryId) ?? null : null}
            on={date}
            onToggle={onToggle}
            onOpen={onOpen}
            onRequestDelete={onRequestDelete}
          />
        </li>
      ))}
    </ul>
  );
}
