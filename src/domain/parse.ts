/**
 * 바깥에서 들어온 값을 도메인 타입으로 되돌린다.
 *
 * localStorage와 백업 파일이 같은 파서를 쓴다.
 * 두 곳에 따로 두면 한쪽만 새 필드를 알게 되어, 백업으로 복원한 데이터가
 * 앱에서 조금씩 다르게 보이기 시작한다.
 *
 * 원칙: 깨진 항목 하나 때문에 전체를 버리지 않는다.
 * 살릴 수 있으면 고쳐서 살리고, 못 살리면 그 항목만 뺀다.
 */

import { normalizePaletteKey } from "./palette";
import { normalizeRecurrence, recurrenceEndDate } from "./recurrence";
import {
  DEFAULT_REMINDER_TIME,
  isReminderOffset,
  normalizeReminderTime,
} from "./reminder";
import type { Category, Task, TaskCompletion } from "./types";

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseCategory(v: unknown): Category | null {
  if (!isRecord(v)) return null;
  const { id, name, color, sortOrder } = v;
  if (typeof id !== "string" || id === "") return null;
  if (typeof name !== "string") return null;
  // 파스텔 시절 키(sage·mist·clay…)는 새 비비드 키로 조용히 갈아끼운다
  const normalized = normalizePaletteKey(color);
  if (!normalized) return null;
  return {
    id,
    name,
    color: normalized,
    sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
  };
}

export function parseTask(v: unknown): Task | null {
  if (!isRecord(v)) return null;
  const { id, title, startDate, endDate } = v;
  if (typeof id !== "string" || id === "") return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof startDate !== "string" || !ISO_DATE.test(startDate)) return null;
  if (typeof endDate !== "string" || !ISO_DATE.test(endDate)) return null;
  // 뒤집힌 기간은 살려서 고친다 — 버린다고 사용자에게 좋을 게 없다
  const [from, to] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];

  const checkMode = v.checkMode === "daily" ? "daily" : "once";
  const completedDates = Array.isArray(v.completedDates)
    ? v.completedDates.filter(
        (d): d is string => typeof d === "string" && ISO_DATE.test(d),
      )
    : [];

  // 반복·알림은 나중에 생긴 필드다. 없으면 "반복 없음 / 알림 꺼짐"으로 읽는다
  const recurrence = normalizeRecurrence(v.recurrence);

  return {
    id,
    categoryId: typeof v.categoryId === "string" ? v.categoryId : null,
    title,
    memo: typeof v.memo === "string" ? v.memo : undefined,
    startDate: from,
    // 반복이 있으면 종료일은 규칙이 정한다 — 규칙과 endDate가 어긋나면 달력에서 사라진다
    endDate: recurrence ? recurrenceEndDate(recurrence) : to,
    checkMode,
    done: v.done === true,
    completedDates,
    recurrence,
    reminder: isReminderOffset(v.reminder) ? v.reminder : "none",
    reminderTime:
      v.reminderTime === undefined
        ? DEFAULT_REMINDER_TIME
        : normalizeReminderTime(v.reminderTime),
    sortOrder: typeof v.sortOrder === "number" ? v.sortOrder : 0,
    createdAt:
      typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
  };
}

export function parseCompletion(v: unknown): TaskCompletion | null {
  if (!isRecord(v)) return null;
  const { taskId, date } = v;
  if (typeof taskId !== "string" || taskId === "") return null;
  if (typeof date !== "string" || !ISO_DATE.test(date)) return null;
  return { taskId, date };
}

/** 사라진 카테고리를 가리키는 할일을 미분류로 돌린다 (원본을 그 자리에서 고친다) */
export function reattachOrphans(categories: Category[], tasks: Task[]): void {
  const ids = new Set(categories.map((c) => c.id));
  for (const t of tasks) {
    if (t.categoryId !== null && !ids.has(t.categoryId)) t.categoryId = null;
  }
}

/** 존재하지 않는 할일을 가리키는 완료 기록은 버린다 */
export function pruneCompletions(
  tasks: readonly Task[],
  completions: readonly TaskCompletion[],
): TaskCompletion[] {
  const ids = new Set(tasks.map((t) => t.id));
  const seen = new Set<string>();
  return completions.filter((c) => {
    if (!ids.has(c.taskId)) return false;
    const key = `${c.taskId}#${c.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
