/**
 * 알림 시각 계산 — 순수 함수만.
 *
 * 브라우저 API는 여기 없다. Notification도 setTimeout도 부르지 않는다.
 * "언제 울려야 하는가"만 답하고, 실제로 울리는 일은 lib/notifications.ts가 한다.
 *
 * 기본값은 꺼짐이다. 권한 요청도 사용자가 알림을 켤 때만 일어난다 —
 * 첫 방문자에게 권한 팝업을 들이미는 순간 창이 닫힌다 (04-engagement E2와 같은 이유).
 */

import { addDays } from "./date";
import { occursOn } from "./task";
import {
  EMPTY_COMPLETIONS,
  isCompletedOn,
  type CompletionSet,
} from "./recurrence";
import type { ISODate, ReminderOffset, Task } from "./types";

export const DEFAULT_REMINDER_TIME = "09:00";

/** 기준 시각에서 몇 분 앞당길지 */
const OFFSET_MINUTES: Record<ReminderOffset, number> = {
  none: 0,
  at: 0,
  "10m": 10,
  "1h": 60,
  "1d": 24 * 60,
};

export const REMINDER_OPTIONS: {
  value: ReminderOffset;
  label: string;
}[] = [
  { value: "none", label: "알림 없음" },
  { value: "at", label: "정시" },
  { value: "10m", label: "10분 전" },
  { value: "1h", label: "1시간 전" },
  { value: "1d", label: "하루 전" },
];

const OFFSET_LABELS = new Map(REMINDER_OPTIONS.map((o) => [o.value, o.label]));

export function reminderLabel(offset: ReminderOffset): string {
  return OFFSET_LABELS.get(offset) ?? "알림 없음";
}

export function isReminderOffset(value: unknown): value is ReminderOffset {
  return typeof value === "string" && value in OFFSET_MINUTES;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "9:5" 같은 값도 살려서 읽고, 알 수 없으면 기본 시각으로 */
export function normalizeReminderTime(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_REMINDER_TIME;
  if (HHMM.test(value)) return value;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!m) return DEFAULT_REMINDER_TIME;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return DEFAULT_REMINDER_TIME;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/**
 * 그 회차의 알림이 울려야 할 순간.
 * offset이 none이면 null — 울릴 일이 없다.
 */
export function reminderMoment(
  date: ISODate,
  time: string,
  offset: ReminderOffset,
): Date | null {
  if (offset === "none") return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = normalizeReminderTime(time).split(":").map(Number);
  const base = new Date(y, m - 1, d, hh, mm, 0, 0);
  base.setMinutes(base.getMinutes() - OFFSET_MINUTES[offset]);
  return base;
}

/** 같은 할일 · 같은 날짜 · 같은 설정이면 한 번만 울린다 */
export function reminderKey(
  taskId: string,
  date: ISODate,
  offset: ReminderOffset,
): string {
  return `${taskId}#${date}#${offset}`;
}

export interface DueReminder {
  key: string;
  taskId: string;
  title: string;
  date: ISODate;
  offset: ReminderOffset;
}

/**
 * 앱이 닫혀 있던 사이에 지나간 알림을 몇 시간까지 되살릴지.
 * 무제한이면 오랜만에 열었을 때 지난 알림이 한꺼번에 쏟아진다.
 */
const GRACE_MS = 2 * 60 * 60 * 1000;

function toISO(date: Date): ISODate {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/**
 * 지금 울려야 할 알림들.
 *
 * 후보 날짜는 오늘 ~ 모레뿐이다 — 가장 이른 알림이 '하루 전'이라
 * 그보다 먼 회차는 아직 울릴 때가 아니다.
 * 이미 완료한 회차와 이미 울린 알림은 제외한다.
 */
export function dueReminders(
  tasks: readonly Task[],
  now: Date,
  fired: ReadonlySet<string>,
  completions: CompletionSet = EMPTY_COMPLETIONS,
): DueReminder[] {
  const out: DueReminder[] = [];
  const today = toISO(now);
  const candidates = [today, addDays(today, 1), addDays(today, 2)];
  const nowMs = now.getTime();

  for (const task of tasks) {
    if (task.reminder === "none") continue;

    for (const date of candidates) {
      if (!occursOn(task, date)) continue;

      const key = reminderKey(task.id, date, task.reminder);
      if (fired.has(key)) continue;

      // 이미 끝낸 일에 알림을 보내지 않는다
      if (task.recurrence) {
        if (isCompletedOn(completions, task.id, date)) continue;
      } else if (task.checkMode === "once") {
        if (task.done) continue;
      } else if (task.completedDates.includes(date)) {
        continue;
      }

      const moment = reminderMoment(date, task.reminderTime, task.reminder);
      if (!moment) continue;
      const diff = nowMs - moment.getTime();
      if (diff < 0 || diff > GRACE_MS) continue;

      out.push({
        key,
        taskId: task.id,
        title: task.title,
        date,
        offset: task.reminder,
      });
    }
  }

  return out;
}
