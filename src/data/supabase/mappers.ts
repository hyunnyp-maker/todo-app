/**
 * DB(snake_case) ↔ 도메인(camelCase) 변환.
 *
 * 이 경계가 있어서 도메인 타입이 Postgres 컬럼명을 몰라도 된다.
 */

import { normalizePaletteKey } from "@/domain/palette";
import { normalizeRecurrence, recurrenceEndDate } from "@/domain/recurrence";
import {
  DEFAULT_REMINDER_TIME,
  isReminderOffset,
  normalizeReminderTime,
} from "@/domain/reminder";
import type { Category, Task, TaskCompletion } from "@/domain/types";

export interface CategoryRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface TaskRow {
  id: string;
  category_id: string | null;
  title: string;
  memo: string | null;
  start_date: string;
  end_date: string;
  check_mode: string;
  done: boolean;
  completed_dates: string[] | null;
  recurrence: unknown;
  reminder: string | null;
  reminder_time: string | null;
  sort_order: number;
  created_at: string;
}

export interface CompletionRow {
  task_id: string;
  date: string;
}

export function toCompletion(row: CompletionRow): TaskCompletion {
  return { taskId: row.task_id, date: row.date };
}

export function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    // 옛 파스텔 키는 새 키로 옮기고, 알 수 없는 값이면 화면이 깨지지 않게 기본값으로
    color: normalizePaletteKey(row.color) ?? "ink",
    sortOrder: row.sort_order,
  };
}

export function fromCategory(category: Category) {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    sort_order: category.sortOrder,
  };
}

export function toTask(row: TaskRow): Task {
  const recurrence = normalizeRecurrence(row.recurrence);
  return {
    id: row.id,
    categoryId: row.category_id,
    title: row.title,
    memo: row.memo ?? undefined,
    startDate: row.start_date,
    // 규칙이 있으면 종료일의 진실은 규칙 쪽이다
    endDate: recurrence ? recurrenceEndDate(recurrence) : row.end_date,
    checkMode: row.check_mode === "daily" ? "daily" : "once",
    done: row.done,
    completedDates: row.completed_dates ?? [],
    recurrence,
    reminder: isReminderOffset(row.reminder) ? row.reminder : "none",
    reminderTime:
      row.reminder_time === null
        ? DEFAULT_REMINDER_TIME
        : normalizeReminderTime(row.reminder_time),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export function fromTask(task: Task) {
  return {
    id: task.id,
    category_id: task.categoryId,
    title: task.title,
    memo: task.memo ?? null,
    start_date: task.startDate,
    end_date: task.endDate,
    check_mode: task.checkMode,
    done: task.done,
    completed_dates: task.completedDates,
    recurrence: task.recurrence,
    reminder: task.reminder,
    reminder_time: task.reminderTime,
    sort_order: task.sortOrder,
  };
}

/** 부분 수정 — 넘어온 필드만 컬럼으로 바꾼다 */
export function fromTaskPatch(patch: Partial<Task>) {
  const row: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.memo !== undefined) row.memo = patch.memo ?? null;
  if (patch.startDate !== undefined) row.start_date = patch.startDate;
  if (patch.endDate !== undefined) row.end_date = patch.endDate;
  if (patch.checkMode !== undefined) row.check_mode = patch.checkMode;
  if (patch.done !== undefined) row.done = patch.done;
  if (patch.completedDates !== undefined) row.completed_dates = patch.completedDates;
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence;
  if (patch.reminder !== undefined) row.reminder = patch.reminder;
  if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  return row;
}

export function fromCategoryPatch(patch: Partial<Category>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  return row;
}
