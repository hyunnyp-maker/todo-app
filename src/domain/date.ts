/**
 * 날짜 유틸 — 06-architecture.md 2장 (domain 계층)
 *
 * 모든 날짜는 "YYYY-MM-DD" 문자열로 다룬다.
 * Date 객체는 계산 중에만 쓰고 밖으로 내보내지 않는다 — 시간대 문제를 원천 차단하기 위해.
 * 파싱·생성은 항상 로컬 시간 기준(new Date(y, m, d))이며 UTC 변환을 거치지 않는다.
 */

import type { DateRange, ISODate, ISOMonth } from "./types";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "YYYY-MM-DD" → 로컬 자정 Date */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** b - a (일 단위). 같은 날이면 0 */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** 기간의 총 일수. 하루짜리면 1 */
export function dayCount(start: ISODate, end: ISODate): number {
  return diffDays(start, end) + 1;
}

/** start 기준 몇 일차인지. 첫날이면 1 */
export function dayIndex(start: ISODate, on: ISODate): number {
  return diffDays(start, on) + 1;
}

/** 남은 일수. 오늘이 마감이면 0, 지났으면 음수 */
export function daysLeft(end: ISODate, today: ISODate): number {
  return diffDays(today, end);
}

/** 0=일 … 6=토 */
export function weekdayIndex(iso: ISODate): number {
  return parseISODate(iso).getDay();
}

/** 그 날짜의 일(日). "2026-08-03" → 3 */
export function dayOfMonthOf(iso: ISODate): number {
  return Number(iso.slice(8, 10));
}

/** 그 달의 마지막 날짜 (28~31) */
export function lastDayOfMonth(iso: ISODate): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// ── 월 ────────────────────────────────────────

export function monthOf(iso: ISODate): ISOMonth {
  return iso.slice(0, 7);
}

export function startOfMonth(month: ISOMonth): ISODate {
  return `${month}-01`;
}

export function endOfMonth(month: ISOMonth): ISODate {
  const [y, m] = month.split("-").map(Number);
  return toISODate(new Date(y, m, 0)); // 다음 달 0일 = 이번 달 마지막 날
}

export function addMonths(month: ISOMonth, delta: number): ISOMonth {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function isSameMonth(iso: ISODate, month: ISOMonth): boolean {
  return monthOf(iso) === month;
}

// ── 월 그리드 ──────────────────────────────────

/** 그리드 행 수는 항상 6으로 고정한다.
 *  달마다 높이가 달라지면 05-design 4.2의 세로 예산이 흔들리고 레이아웃이 튄다. */
export const GRID_ROWS = 6;
export const GRID_COLS = 7;

/**
 * 월간 달력 그리드. 일요일 시작, 6주 × 7일 = 42칸.
 * 앞뒤로 이전/다음 달 날짜가 채워진다.
 */
export function buildMonthGrid(month: ISOMonth): ISODate[][] {
  const first = parseISODate(startOfMonth(month));
  const leading = first.getDay(); // 0=일
  const gridStart = addDays(startOfMonth(month), -leading);

  const rows: ISODate[][] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: ISODate[] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      row.push(addDays(gridStart, r * GRID_COLS + c));
    }
    rows.push(row);
  }
  return rows;
}

/**
 * 그리드가 실제로 덮는 날짜 범위.
 * 조회는 이 범위로 한다 — 달력에 보이는 이전/다음 달 칸의 할일도 필요하기 때문.
 */
export function monthGridRange(month: ISOMonth): DateRange {
  const grid = buildMonthGrid(month);
  return { from: grid[0][0], to: grid[GRID_ROWS - 1][GRID_COLS - 1] };
}

// ── 기간 겹침 ──────────────────────────────────

/**
 * 두 기간이 하루라도 겹치는가.
 *
 * 이 함수가 이 파일에서 가장 중요하다.
 * 단순히 "시작일이 범위 안에 있는가"로 판단하면
 * 3/28~4/3 같은 할일이 4월 달력에서 통째로 사라진다.
 */
export function overlaps(
  a: { start: ISODate; end: ISODate },
  b: { start: ISODate; end: ISODate },
): boolean {
  return a.start <= b.end && a.end >= b.start;
}

export function overlapsRange(
  start: ISODate,
  end: ISODate,
  range: DateRange,
): boolean {
  return overlaps({ start, end }, { start: range.from, end: range.to });
}

/** 특정 날짜가 기간에 포함되는가 */
export function covers(start: ISODate, end: ISODate, on: ISODate): boolean {
  return start <= on && on <= end;
}

/** 기간에 포함된 모든 날짜 */
export function datesBetween(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

// ── 표시용 ─────────────────────────────────────

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function weekdayKo(iso: ISODate): string {
  return WEEKDAY_KO[parseISODate(iso).getDay()];
}

export const WEEKDAY_LABELS = WEEKDAY_KO;

/** "2026년 8월" */
export function formatMonthTitle(month: ISOMonth): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** "8월 3일" */
export function formatDayShort(iso: ISODate): string {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** "8/14" */
export function formatDaySlash(iso: ISODate): string {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
