/**
 * 반복 일정 — 규칙만 저장하고 날짜는 계산한다.
 *
 * 반복 일정 하나를 만들 때 365개의 행을 만들지 않는다.
 * 규칙 한 줄만 저장하고, "이 날짜에 뜨는가"를 조회 시점에 판정한다.
 * 그래서 규칙을 고치면 과거·미래가 한꺼번에 따라온다 (단일 회차 수정은 v2).
 *
 * 완료는 본체가 아니라 TaskCompletion(taskId + date)에 남는다.
 * 규칙을 바꿔도, 기간을 줄였다 늘려도 체크 이력이 살아 있다.
 */

import {
  addDays,
  dayOfMonthOf,
  lastDayOfMonth,
  weekdayIndex,
} from "./date";
import type {
  DateRange,
  ISODate,
  RecurrenceRule,
  RecurrenceType,
  TaskCompletion,
} from "./types";

/**
 * 종료 없음일 때 Task.endDate에 넣는 값.
 *
 * null을 쓰지 않는 이유: 기존 조회가 전부 start_date ≤ to AND end_date ≥ from 이다.
 * null이면 그 조건에서 빠져 반복 일정만 달력에서 사라진다.
 * 먼 미래 날짜를 넣으면 조회 코드도 인덱스도 그대로 쓸 수 있다.
 */
export const NO_END_DATE: ISODate = "9999-12-31";

/** 한 번의 계산이 훑을 수 있는 최대 일수 — 잘못된 범위가 들어와도 멈춘다 */
const MAX_SCAN_DAYS = 400;

export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  daily: "매일",
  weekdays: "평일",
  weekly: "매주",
  monthly: "매월",
};

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

// ── 판정 ──────────────────────────────────────

/** 규칙 자체가 그 요일/날짜를 포함하는가. 시작일·종료일은 보지 않는다 */
function matchesPattern(rule: RecurrenceRule, on: ISODate): boolean {
  switch (rule.type) {
    case "daily":
      return true;
    case "weekdays": {
      const d = weekdayIndex(on);
      return d >= 1 && d <= 5;
    }
    case "weekly":
      return rule.daysOfWeek.includes(weekdayIndex(on));
    case "monthly": {
      // 31일 반복은 30일까지인 달에서 사라지면 안 된다.
      // 그 달의 마지막 날로 당겨서 한 번은 뜨게 한다.
      const target = Math.min(rule.dayOfMonth, lastDayOfMonth(on));
      return dayOfMonthOf(on) === target;
    }
  }
}

/**
 * 반복 일정이 그 날짜에 뜨는가.
 * start는 Task.startDate(반복 시작일)다. 시작 전에는 뜨지 않는다.
 */
export function ruleOccursOn(
  rule: RecurrenceRule,
  start: ISODate,
  on: ISODate,
): boolean {
  if (on < start) return false;
  if (rule.endDate && on > rule.endDate) return false;
  return matchesPattern(rule, on);
}

/**
 * 범위 안에서 실제로 뜨는 날짜들.
 * 달력은 42칸이므로 이 범위는 항상 유한하다. 종료 없음이어도 여기서 잘린다.
 */
export function ruleDatesInRange(
  rule: RecurrenceRule,
  start: ISODate,
  range: DateRange,
): ISODate[] {
  const from = start > range.from ? start : range.from;
  const to = rule.endDate && rule.endDate < range.to ? rule.endDate : range.to;
  if (from > to) return [];

  const out: ISODate[] = [];
  let cursor = from;
  for (let i = 0; i < MAX_SCAN_DAYS && cursor <= to; i++) {
    if (matchesPattern(rule, cursor)) out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** 규칙에 맞춰 Task.endDate에 넣을 값 */
export function recurrenceEndDate(rule: RecurrenceRule): ISODate {
  return rule.endDate ?? NO_END_DATE;
}

// ── 표시 ──────────────────────────────────────

/** "매일" · "평일" · "매주 월·수·금" · "매월 15일" */
export function describeRecurrence(rule: RecurrenceRule): string {
  switch (rule.type) {
    case "daily":
      return "매일";
    case "weekdays":
      return "평일";
    case "weekly": {
      if (rule.daysOfWeek.length === 0) return "매주";
      const days = [...rule.daysOfWeek]
        .sort((a, b) => a - b)
        .map((d) => WEEKDAY_KO[d])
        .join("·");
      return `매주 ${days}`;
    }
    case "monthly":
      return `매월 ${rule.dayOfMonth}일`;
  }
}

// ── 검증 ──────────────────────────────────────

function normalizeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<number>();
  for (const v of value) {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 6) {
      set.add(v);
    }
  }
  return [...set].sort((a, b) => a - b);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeEnd(value: unknown): ISODate | undefined {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return undefined;
  // 종료 없음의 내부 표현이 규칙 안으로 새어 들어오지 않게 한다
  if (value === NO_END_DATE) return undefined;
  return value;
}

/**
 * 저장된 값을 규칙으로 되돌린다. 알 수 없으면 null(반복 없음)로 떨어뜨린다.
 * 요일이 하나도 없는 weekly, 범위를 벗어난 monthly는 규칙으로 인정하지 않는다.
 */
export function normalizeRecurrence(value: unknown): RecurrenceRule | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const endDate = normalizeEnd(v.endDate);

  switch (v.type) {
    case "daily":
      return endDate ? { type: "daily", endDate } : { type: "daily" };
    case "weekdays":
      return endDate ? { type: "weekdays", endDate } : { type: "weekdays" };
    case "weekly": {
      const daysOfWeek = normalizeDays(v.daysOfWeek);
      if (daysOfWeek.length === 0) return null;
      return endDate
        ? { type: "weekly", daysOfWeek, endDate }
        : { type: "weekly", daysOfWeek };
    }
    case "monthly": {
      const day = v.dayOfMonth;
      if (typeof day !== "number" || !Number.isInteger(day) || day < 1 || day > 31) {
        return null;
      }
      return endDate
        ? { type: "monthly", dayOfMonth: day, endDate }
        : { type: "monthly", dayOfMonth: day };
    }
    default:
      return null;
  }
}

// ── 완료 기록 ──────────────────────────────────

/** 완료 조회를 O(1)로 만드는 키 */
export function completionKey(taskId: string, date: ISODate): string {
  return `${taskId}#${date}`;
}

export type CompletionSet = ReadonlySet<string>;

export const EMPTY_COMPLETIONS: CompletionSet = new Set<string>();

export function buildCompletionSet(
  rows: readonly TaskCompletion[],
): CompletionSet {
  return new Set(rows.map((r) => completionKey(r.taskId, r.date)));
}

export function isCompletedOn(
  completions: CompletionSet,
  taskId: string,
  date: ISODate,
): boolean {
  return completions.has(completionKey(taskId, date));
}
