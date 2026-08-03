import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_TIME,
  dueReminders,
  isReminderOffset,
  normalizeReminderTime,
  reminderKey,
  reminderMoment,
} from "./reminder";
import { buildCompletionSet, NO_END_DATE } from "./recurrence";
import type { Task } from "./types";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    categoryId: "work",
    title: "회의 준비",
    startDate: "2026-08-03",
    endDate: "2026-08-03",
    checkMode: "once",
    done: false,
    completedDates: [],
    recurrence: null,
    reminder: "none",
    reminderTime: "09:00",
    sortOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

/** 로컬 시간 기준으로 만든다 — reminderMoment도 로컬 기준이다 */
function at(y: number, m: number, d: number, h: number, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0);
}

describe("시각 계산", () => {
  it("정시는 기준 시각 그대로", () => {
    expect(reminderMoment("2026-08-03", "09:00", "at")).toEqual(
      at(2026, 8, 3, 9),
    );
  });

  it("10분 전 · 1시간 전 · 하루 전", () => {
    expect(reminderMoment("2026-08-03", "09:00", "10m")).toEqual(
      at(2026, 8, 3, 8, 50),
    );
    expect(reminderMoment("2026-08-03", "09:00", "1h")).toEqual(
      at(2026, 8, 3, 8),
    );
    expect(reminderMoment("2026-08-03", "09:00", "1d")).toEqual(
      at(2026, 8, 2, 9),
    );
  });

  it("자정을 넘어가도 날짜가 함께 넘어간다", () => {
    expect(reminderMoment("2026-08-03", "00:30", "1h")).toEqual(
      at(2026, 8, 2, 23, 30),
    );
  });

  it("알림 없음은 울릴 순간이 없다", () => {
    expect(reminderMoment("2026-08-03", "09:00", "none")).toBeNull();
  });
});

describe("시각 정규화", () => {
  it("정상 값은 그대로", () => {
    expect(normalizeReminderTime("07:05")).toBe("07:05");
    expect(normalizeReminderTime("23:59")).toBe("23:59");
  });

  it("자릿수가 모자라면 채운다", () => {
    expect(normalizeReminderTime("9:5")).toBe("09:05");
  });

  it("알 수 없으면 기본 시각", () => {
    expect(normalizeReminderTime("아침")).toBe(DEFAULT_REMINDER_TIME);
    expect(normalizeReminderTime("25:00")).toBe(DEFAULT_REMINDER_TIME);
    expect(normalizeReminderTime(undefined)).toBe(DEFAULT_REMINDER_TIME);
  });

  it("설정값 판별", () => {
    expect(isReminderOffset("10m")).toBe(true);
    expect(isReminderOffset("30m")).toBe(false);
  });
});

describe("발송 대상", () => {
  const base = task({ reminder: "at", reminderTime: "09:00" });
  const none = new Set<string>();

  it("기본은 꺼짐이라 아무것도 울리지 않는다", () => {
    expect(dueReminders([task()], at(2026, 8, 3, 9), none)).toEqual([]);
  });

  it("시각이 되면 울린다", () => {
    const out = dueReminders([base], at(2026, 8, 3, 9), none);
    expect(out.map((r) => r.taskId)).toEqual(["t1"]);
  });

  it("시각 전에는 울리지 않는다", () => {
    expect(dueReminders([base], at(2026, 8, 3, 8, 59), none)).toEqual([]);
  });

  it("같은 알림을 두 번 보내지 않는다", () => {
    const fired = new Set([reminderKey("t1", "2026-08-03", "at")]);
    expect(dueReminders([base], at(2026, 8, 3, 9), fired)).toEqual([]);
  });

  it("이미 끝낸 일에는 보내지 않는다", () => {
    const done = task({ reminder: "at", done: true });
    expect(dueReminders([done], at(2026, 8, 3, 9), none)).toEqual([]);
  });

  it("한참 지난 알림은 되살리지 않는다", () => {
    // 오랜만에 열었을 때 지난 알림이 쏟아지면 알림을 꺼버리게 된다
    expect(dueReminders([base], at(2026, 8, 3, 20), none)).toEqual([]);
    expect(dueReminders([base], at(2026, 8, 3, 10, 30), none)).toHaveLength(1);
  });

  it("하루 전 알림은 전날에 울린다", () => {
    const early = task({ reminder: "1d", reminderTime: "09:00" });
    const out = dueReminders([early], at(2026, 8, 2, 9), none);
    expect(out.map((r) => r.date)).toEqual(["2026-08-03"]);
  });

  it("반복 일정은 그날 회차가 있을 때만 울린다", () => {
    const weekly = task({
      id: "r1",
      reminder: "at",
      recurrence: { type: "weekly", daysOfWeek: [1] }, // 월요일
      endDate: NO_END_DATE,
    });
    // 2026-08-03 월 / 2026-08-04 화
    expect(dueReminders([weekly], at(2026, 8, 3, 9), none)).toHaveLength(1);
    expect(dueReminders([weekly], at(2026, 8, 4, 9), none)).toEqual([]);
  });

  it("반복 일정의 그 회차를 이미 체크했으면 울리지 않는다", () => {
    const daily = task({
      id: "r2",
      reminder: "at",
      recurrence: { type: "daily" },
      endDate: NO_END_DATE,
    });
    const completions = buildCompletionSet([
      { taskId: "r2", date: "2026-08-03" },
    ]);
    expect(
      dueReminders([daily], at(2026, 8, 3, 9), none, completions),
    ).toEqual([]);
    expect(dueReminders([daily], at(2026, 8, 3, 9), none)).toHaveLength(1);
  });

  it("알림 키는 할일·날짜·설정을 모두 포함한다", () => {
    expect(reminderKey("t1", "2026-08-03", "10m")).toBe("t1#2026-08-03#10m");
  });
});
