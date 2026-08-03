/**
 * 할일 도메인 로직 — 순수 함수만.
 *
 * 핵심 판단 두 가지가 여기 모여 있다.
 *  1. 완료 판정이 checkMode에 따라 갈린다 (once = done / daily = 날짜별)
 *  2. 정렬은 "미완료 → 완료", 각 그룹 안에서 "지속형은 뒤"
 *     지속형은 기간 내내 매일 등장하므로, 앞에 두면 다른 할일을 밀어낸다 (03-scenarios S4)
 */

import { covers, datesBetween, dayCount, dayIndex } from "./date";
import type { Category, ISODate, Task } from "./types";

// ── 완료 판정 ──────────────────────────────────

export function isMultiDay(task: Task): boolean {
  return task.startDate !== task.endDate;
}

/** 기간 전체가 완료되었는가 */
export function isTaskComplete(task: Task): boolean {
  if (task.checkMode === "once") return task.done;
  const total = dayCount(task.startDate, task.endDate);
  return countCompleted(task) >= total;
}

/** 특정 날짜에 대해 체크되어 있는가 */
export function isDoneOn(task: Task, on: ISODate): boolean {
  if (task.checkMode === "once") return task.done;
  return task.completedDates.includes(on);
}

/** 지속형에서 실제 기간 안에 있는 체크만 센다.
 *  기간을 줄이면 밖으로 밀려난 체크가 생기는데, 그것까지 세면 진행률이 100%를 넘는다. */
export function countCompleted(task: Task): number {
  if (task.checkMode === "once") return task.done ? 1 : 0;
  const seen = new Set<ISODate>();
  for (const d of task.completedDates) {
    if (covers(task.startDate, task.endDate, d)) seen.add(d);
  }
  return seen.size;
}

export interface Progress {
  done: number;
  total: number;
}

/** 지속형 진행률. "12/31일" 표기의 원본 */
export function dailyProgress(task: Task): Progress {
  return {
    done: countCompleted(task),
    total: dayCount(task.startDate, task.endDate),
  };
}

/** 날짜별 체크 토글. 원본을 바꾸지 않고 새 배열을 만든다 */
export function toggleCompletedDate(task: Task, on: ISODate): ISODate[] {
  const has = task.completedDates.includes(on);
  return has
    ? task.completedDates.filter((d) => d !== on)
    : [...task.completedDates, on].sort();
}

// ── 날짜별 조회 ────────────────────────────────

/** 그 날짜에 걸쳐 있는 할일. 기간 중간에 낀 날짜도 포함된다 */
export function tasksOnDate(tasks: readonly Task[], on: ISODate): Task[] {
  return tasks.filter((t) => covers(t.startDate, t.endDate, on));
}

/**
 * 날짜 → 할일 목록 인덱스.
 * 달력은 42칸을 그리므로, 칸마다 filter를 돌리면 O(42 × N)이 된다.
 * 한 번만 순회해 Map을 만든다 (06-architecture 6장).
 */
export function buildDateIndex(tasks: readonly Task[]): Map<ISODate, Task[]> {
  const index = new Map<ISODate, Task[]>();
  for (const task of tasks) {
    for (const d of datesBetween(task.startDate, task.endDate)) {
      const bucket = index.get(d);
      if (bucket) bucket.push(task);
      else index.set(d, [task]);
    }
  }
  return index;
}

// ── 정렬 ──────────────────────────────────────

function categoryRank(
  task: Task,
  order: ReadonlyMap<string, number>,
): number {
  if (task.categoryId === null) return Number.MAX_SAFE_INTEGER; // 미분류는 맨 뒤
  return order.get(task.categoryId) ?? Number.MAX_SAFE_INTEGER - 1;
}

/**
 * 표시 순서
 *   1) 미완료 → 완료
 *   2) 각 그룹 안에서 마감형 → 지속형
 *   3) 카테고리 순서
 *   4) sortOrder
 */
export function sortTasksForDate(
  tasks: readonly Task[],
  on: ISODate,
  categories: readonly Category[] = [],
): Task[] {
  const order = new Map(categories.map((c) => [c.id, c.sortOrder]));
  return [...tasks].sort((a, b) => {
    const doneA = isDoneOn(a, on) ? 1 : 0;
    const doneB = isDoneOn(b, on) ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;

    const dailyA = a.checkMode === "daily" ? 1 : 0;
    const dailyB = b.checkMode === "daily" ? 1 : 0;
    if (dailyA !== dailyB) return dailyA - dailyB;

    const catA = categoryRank(a, order);
    const catB = categoryRank(b, order);
    if (catA !== catB) return catA - catB;

    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// ── 필터 ──────────────────────────────────────

export interface TaskFilter {
  /** 숨긴 카테고리. 미분류는 UNCATEGORIZED_ID로 들어온다 */
  hiddenCategoryIds: readonly string[];
  hideCompleted: boolean;
  /** 지정하면 그 날짜 기준으로 완료를 판정한다. 없으면 기간 전체 완료만 숨긴다 */
  on?: ISODate;
}

const UNCATEGORIZED = "__none__";

/**
 * 필터는 달력과 리스트에 똑같이 적용된다 (요구사항 F5-1).
 * 리스트에서 숨겼는데 달력에 점이 남아 있으면 필터가 켜진 줄 모른다.
 */
export function filterTasks(
  tasks: readonly Task[],
  filter: TaskFilter,
): Task[] {
  const hidden = new Set(filter.hiddenCategoryIds);
  return tasks.filter((t) => {
    const key = t.categoryId ?? UNCATEGORIZED;
    if (hidden.has(key)) return false;
    if (!filter.hideCompleted) return true;
    return filter.on ? !isDoneOn(t, filter.on) : !isTaskComplete(t);
  });
}

// ── 밀린 할일 (E5) ──────────────────────────────

/**
 * 마감이 지났는데 완료되지 않은 할일.
 *
 * 지속형은 제외한다. 매일 뜨는 것에 "밀림"은 성립하지 않고,
 * 한 번 빼먹었다고 밀림 목록에 올리면 목록이 금세 무의미해진다 (04-engagement E5).
 */
export function overdueTasks(tasks: readonly Task[], today: ISODate): Task[] {
  return tasks.filter(
    (t) => t.checkMode === "once" && !t.done && t.endDate < today,
  );
}

// ── 표시 문자열 ────────────────────────────────

export interface TaskMeta {
  /** 카테고리 이름 — 색만으로 구분하지 않기 위해 항상 표시한다 */
  categoryName: string;
  /** "8/14까지" · "12/31일" · null(하루짜리 마감형) */
  detail: string | null;
}

export function taskDetailText(task: Task, on: ISODate): string | null {
  if (task.checkMode === "daily") {
    const { done, total } = dailyProgress(task);
    return `${done}/${total}일`;
  }
  if (!isMultiDay(task)) return null;
  const idx = dayIndex(task.startDate, on);
  const total = dayCount(task.startDate, task.endDate);
  return `${idx}/${total}일차`;
}
