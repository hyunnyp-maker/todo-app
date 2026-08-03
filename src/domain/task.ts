/**
 * 할일 도메인 로직 — 순수 함수만.
 *
 * 핵심 판단 두 가지가 여기 모여 있다.
 *  1. 완료 판정이 checkMode에 따라 갈린다 (once = done / daily = 날짜별)
 *  2. 정렬은 "미완료 → 완료", 각 그룹 안에서 "지속형은 뒤"
 *     지속형은 기간 내내 매일 등장하므로, 앞에 두면 다른 할일을 밀어낸다 (03-scenarios S4)
 */

import { covers, datesBetween, dayCount, dayIndex } from "./date";
import {
  describeRecurrence,
  EMPTY_COMPLETIONS,
  isCompletedOn,
  ruleDatesInRange,
  ruleOccursOn,
  type CompletionSet,
} from "./recurrence";
import type {
  Category,
  DateRange,
  ISODate,
  RecurrenceRule,
  Task,
} from "./types";

// ── 초안 검증 ──────────────────────────────────

/** 저장 전에 확인해야 하는 최소한. 상세 시트와 음성 확인 화면이 같은 규칙을 쓴다 */
export interface TaskDraftShape {
  title: string;
  startDate: ISODate;
  endDate: ISODate;
  recurrence: RecurrenceRule | null;
}

/**
 * 저장할 수 없는 이유. 저장 가능하면 null.
 *
 * 검증이 두 곳에 따로 있으면 반드시 어긋난다 — 한쪽에서 막은 것이 다른 쪽에서 통과한다.
 */
export function taskDraftError(draft: TaskDraftShape): string | null {
  if (draft.title.trim() === "") return "제목을 입력해 주세요";
  // 반복이면 종료일은 규칙이 들고 있다. endDate는 규칙에서 파생된 값이라 비교 대상이 아니다
  if (!draft.recurrence && draft.endDate < draft.startDate) {
    return "종료일이 시작일보다 앞설 수 없습니다";
  }
  return null;
}

export function isSavableTaskDraft(draft: TaskDraftShape): boolean {
  return taskDraftError(draft) === null;
}

// ── 완료 판정 ──────────────────────────────────

/** 반복 일정은 기간형이 아니다 — endDate가 먼 미래라도 하루짜리로 다룬다 */
export function isMultiDay(task: Task): boolean {
  if (task.recurrence) return false;
  return task.startDate !== task.endDate;
}

/** 기간 전체가 완료되었는가 */
export function isTaskComplete(task: Task): boolean {
  // 반복 일정에 "전체 완료"는 없다. 종료일이 없을 수도 있다
  if (task.recurrence) return false;
  if (task.checkMode === "once") return task.done;
  const total = dayCount(task.startDate, task.endDate);
  return countCompleted(task) >= total;
}

/**
 * 특정 날짜에 대해 체크되어 있는가.
 *
 * 반복 일정만 세 번째 인자를 쓴다 — 완료가 본체가 아니라 별도 기록에 있기 때문.
 * 넘기지 않으면 미완료로 읽히므로, 반복을 다루는 화면은 반드시 함께 넘긴다.
 */
export function isDoneOn(
  task: Task,
  on: ISODate,
  completions: CompletionSet = EMPTY_COMPLETIONS,
): boolean {
  if (task.recurrence) return isCompletedOn(completions, task.id, on);
  if (task.checkMode === "once") return task.done;
  return task.completedDates.includes(on);
}

/** 그 날짜에 이 할일이 뜨는가 — 반복이면 규칙으로, 아니면 기간으로 */
export function occursOn(task: Task, on: ISODate): boolean {
  if (task.recurrence) return ruleOccursOn(task.recurrence, task.startDate, on);
  return covers(task.startDate, task.endDate, on);
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

/** 그 날짜에 걸쳐 있는 할일. 기간 중간에 낀 날짜도, 반복 회차도 포함된다 */
export function tasksOnDate(tasks: readonly Task[], on: ISODate): Task[] {
  return tasks.filter((t) => occursOn(t, on));
}

/**
 * 날짜 → 할일 목록 인덱스.
 * 달력은 42칸을 그리므로, 칸마다 filter를 돌리면 O(42 × N)이 된다.
 * 한 번만 순회해 Map을 만든다 (06-architecture 6장).
 *
 * range가 필수인 이유: 종료 없는 반복 일정의 endDate는 9999-12-31이다.
 * 범위 없이 펼치면 300만 일을 순회한다.
 */
export function buildDateIndex(
  tasks: readonly Task[],
  range: DateRange,
): Map<ISODate, Task[]> {
  const index = new Map<ISODate, Task[]>();
  const push = (d: ISODate, task: Task) => {
    const bucket = index.get(d);
    if (bucket) bucket.push(task);
    else index.set(d, [task]);
  };

  for (const task of tasks) {
    if (task.recurrence) {
      for (const d of ruleDatesInRange(task.recurrence, task.startDate, range)) {
        push(d, task);
      }
      continue;
    }
    const from = task.startDate > range.from ? task.startDate : range.from;
    const to = task.endDate < range.to ? task.endDate : range.to;
    if (from > to) continue;
    for (const d of datesBetween(from, to)) push(d, task);
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
  completions: CompletionSet = EMPTY_COMPLETIONS,
): Task[] {
  const order = new Map(categories.map((c) => [c.id, c.sortOrder]));
  return [...tasks].sort((a, b) => {
    const doneA = isDoneOn(a, on, completions) ? 1 : 0;
    const doneB = isDoneOn(b, on, completions) ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;

    // 매일 등장하는 것(지속형·반복)은 뒤로. 앞에 두면 그날만의 할일을 밀어낸다
    const dailyA = a.recurrence || a.checkMode === "daily" ? 1 : 0;
    const dailyB = b.recurrence || b.checkMode === "daily" ? 1 : 0;
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
  completions: CompletionSet = EMPTY_COMPLETIONS,
): Task[] {
  const hidden = new Set(filter.hiddenCategoryIds);
  return tasks.filter((t) => {
    const key = t.categoryId ?? UNCATEGORIZED;
    if (hidden.has(key)) return false;
    if (!filter.hideCompleted) return true;
    return filter.on
      ? !isDoneOn(t, filter.on, completions)
      : !isTaskComplete(t);
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
    (t) =>
      // 반복 일정도 같은 이유로 제외한다. 어제 못 한 '매일 운동'은 밀린 것이 아니다
      !t.recurrence && t.checkMode === "once" && !t.done && t.endDate < today,
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
  // 반복 일정은 진행률이 아니라 규칙 자체가 정보다
  if (task.recurrence) return describeRecurrence(task.recurrence);
  if (task.checkMode === "daily") {
    const { done, total } = dailyProgress(task);
    return `${done}/${total}일`;
  }
  if (!isMultiDay(task)) return null;
  const idx = dayIndex(task.startDate, on);
  const total = dayCount(task.startDate, task.endDate);
  return `${idx}/${total}일차`;
}
