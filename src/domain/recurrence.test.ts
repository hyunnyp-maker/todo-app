import { describe, expect, it } from "vitest";
import {
  buildCompletionSet,
  completionKey,
  describeRecurrence,
  isCompletedOn,
  NO_END_DATE,
  normalizeRecurrence,
  recurrenceEndDate,
  ruleDatesInRange,
  ruleOccursOn,
} from "./recurrence";
import {
  buildDateIndex,
  isDoneOn,
  isMultiDay,
  isTaskComplete,
  occursOn,
  overdueTasks,
  sortTasksForDate,
  taskDetailText,
  tasksOnDate,
} from "./task";
import type { RecurrenceRule, Task } from "./types";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    categoryId: "work",
    title: "할일",
    startDate: "2026-08-03", // 월요일
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

/** 2026-08-03은 월요일 */
const MON = "2026-08-03";
const SAT = "2026-08-08";
const SUN = "2026-08-09";

describe("매일", () => {
  const rule: RecurrenceRule = { type: "daily" };

  it("시작일부터 모든 날에 뜬다", () => {
    expect(ruleOccursOn(rule, MON, MON)).toBe(true);
    expect(ruleOccursOn(rule, MON, SAT)).toBe(true);
    expect(ruleOccursOn(rule, MON, "2027-01-01")).toBe(true);
  });

  it("시작일 이전에는 뜨지 않는다", () => {
    expect(ruleOccursOn(rule, MON, "2026-08-02")).toBe(false);
  });

  it("종료일 다음날부터 멈춘다", () => {
    const ends: RecurrenceRule = { type: "daily", endDate: "2026-08-05" };
    expect(ruleOccursOn(ends, MON, "2026-08-05")).toBe(true);
    expect(ruleOccursOn(ends, MON, "2026-08-06")).toBe(false);
  });
});

describe("평일", () => {
  const rule: RecurrenceRule = { type: "weekdays" };

  it("월~금만 뜬다", () => {
    expect(ruleOccursOn(rule, MON, MON)).toBe(true);
    expect(ruleOccursOn(rule, MON, "2026-08-07")).toBe(true); // 금
    expect(ruleOccursOn(rule, MON, SAT)).toBe(false);
    expect(ruleOccursOn(rule, MON, SUN)).toBe(false);
  });
});

describe("매주 특정 요일", () => {
  const rule: RecurrenceRule = { type: "weekly", daysOfWeek: [1, 3] }; // 월·수

  it("고른 요일에만 뜬다", () => {
    expect(ruleOccursOn(rule, MON, MON)).toBe(true);
    expect(ruleOccursOn(rule, MON, "2026-08-05")).toBe(true); // 수
    expect(ruleOccursOn(rule, MON, "2026-08-04")).toBe(false); // 화
  });

  it("다음 주도 같은 요일에 뜬다", () => {
    expect(ruleOccursOn(rule, MON, "2026-08-10")).toBe(true); // 다음 월
  });
});

describe("매월 특정 날짜", () => {
  it("그 날짜에만 뜬다", () => {
    const rule: RecurrenceRule = { type: "monthly", dayOfMonth: 15 };
    expect(ruleOccursOn(rule, "2026-08-01", "2026-08-15")).toBe(true);
    expect(ruleOccursOn(rule, "2026-08-01", "2026-09-15")).toBe(true);
    expect(ruleOccursOn(rule, "2026-08-01", "2026-08-16")).toBe(false);
  });

  it("31일 반복은 짧은 달에서 마지막 날로 당겨진다", () => {
    // 사라지게 두면 '매월 31일 마감'이 2월·4월에 통째로 없어진다
    const rule: RecurrenceRule = { type: "monthly", dayOfMonth: 31 };
    expect(ruleOccursOn(rule, "2026-01-01", "2026-01-31")).toBe(true);
    expect(ruleOccursOn(rule, "2026-01-01", "2026-02-28")).toBe(true); // 2026년 2월은 28일까지
    expect(ruleOccursOn(rule, "2026-01-01", "2026-02-27")).toBe(false);
    expect(ruleOccursOn(rule, "2026-01-01", "2026-04-30")).toBe(true);
  });
});

describe("범위 안의 회차", () => {
  it("종료 없는 반복도 범위 안에서만 계산된다", () => {
    const dates = ruleDatesInRange({ type: "daily" }, MON, {
      from: "2026-08-01",
      to: "2026-08-05",
    });
    expect(dates).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });

  it("범위가 시작일보다 앞서면 시작일부터 센다", () => {
    const dates = ruleDatesInRange({ type: "weekdays" }, "2026-08-07", {
      from: "2026-08-01",
      to: "2026-08-11",
    });
    expect(dates).toEqual(["2026-08-07", "2026-08-10", "2026-08-11"]);
  });

  it("종료일이 범위보다 앞서면 거기서 끊는다", () => {
    const dates = ruleDatesInRange(
      { type: "daily", endDate: "2026-08-04" },
      MON,
      { from: "2026-08-01", to: "2026-08-31" },
    );
    expect(dates).toEqual(["2026-08-03", "2026-08-04"]);
  });

  it("범위가 시작 전이면 아무것도 없다", () => {
    expect(
      ruleDatesInRange({ type: "daily" }, "2026-09-01", {
        from: "2026-08-01",
        to: "2026-08-31",
      }),
    ).toEqual([]);
  });
});

describe("종료일 표현", () => {
  it("종료 없음은 먼 미래 날짜로 저장된다 — 기존 범위 조회가 그대로 통하도록", () => {
    expect(recurrenceEndDate({ type: "daily" })).toBe(NO_END_DATE);
    expect(recurrenceEndDate({ type: "daily", endDate: "2026-09-01" })).toBe(
      "2026-09-01",
    );
  });
});

describe("규칙 검증", () => {
  it("알 수 없는 값은 null (= 반복 없음)", () => {
    expect(normalizeRecurrence(null)).toBeNull();
    expect(normalizeRecurrence("매일")).toBeNull();
    expect(normalizeRecurrence({ type: "yearly" })).toBeNull();
  });

  it("요일이 하나도 없는 weekly는 규칙이 아니다", () => {
    // 인정하면 아무 날에도 뜨지 않는 유령 할일이 된다
    expect(normalizeRecurrence({ type: "weekly", daysOfWeek: [] })).toBeNull();
    expect(normalizeRecurrence({ type: "weekly", daysOfWeek: [9] })).toBeNull();
  });

  it("요일은 중복을 없애고 정렬한다", () => {
    expect(
      normalizeRecurrence({ type: "weekly", daysOfWeek: [3, 1, 3] }),
    ).toEqual({ type: "weekly", daysOfWeek: [1, 3] });
  });

  it("범위를 벗어난 monthly는 규칙이 아니다", () => {
    expect(normalizeRecurrence({ type: "monthly", dayOfMonth: 0 })).toBeNull();
    expect(normalizeRecurrence({ type: "monthly", dayOfMonth: 32 })).toBeNull();
    expect(normalizeRecurrence({ type: "monthly", dayOfMonth: 31 })).toEqual({
      type: "monthly",
      dayOfMonth: 31,
    });
  });

  it("종료 없음의 내부 표현은 규칙 안으로 새어 들어오지 않는다", () => {
    expect(normalizeRecurrence({ type: "daily", endDate: NO_END_DATE })).toEqual({
      type: "daily",
    });
  });

  it("잘못된 형식의 종료일은 무시한다", () => {
    expect(normalizeRecurrence({ type: "daily", endDate: "내일" })).toEqual({
      type: "daily",
    });
  });
});

describe("표시 문구", () => {
  it("규칙을 사람 말로 옮긴다", () => {
    expect(describeRecurrence({ type: "daily" })).toBe("매일");
    expect(describeRecurrence({ type: "weekdays" })).toBe("평일");
    expect(
      describeRecurrence({ type: "weekly", daysOfWeek: [3, 1, 5] }),
    ).toBe("매주 월·수·금");
    expect(describeRecurrence({ type: "monthly", dayOfMonth: 15 })).toBe(
      "매월 15일",
    );
  });
});

describe("완료 기록", () => {
  const rows = [
    { taskId: "t1", date: "2026-08-03" },
    { taskId: "t1", date: "2026-08-04" },
    { taskId: "t2", date: "2026-08-03" },
  ];

  it("날짜별로 따로 기억한다", () => {
    const set = buildCompletionSet(rows);
    expect(isCompletedOn(set, "t1", "2026-08-03")).toBe(true);
    expect(isCompletedOn(set, "t1", "2026-08-05")).toBe(false);
    expect(isCompletedOn(set, "t2", "2026-08-04")).toBe(false);
  });

  it("키는 할일과 날짜를 함께 쓴다", () => {
    expect(completionKey("t1", "2026-08-03")).toBe("t1#2026-08-03");
  });
});

describe("반복 일정과 할일 로직", () => {
  const daily = task({
    id: "r1",
    recurrence: { type: "daily" },
    endDate: NO_END_DATE,
  });

  it("완료 판정은 별도 기록을 본다", () => {
    const set = buildCompletionSet([{ taskId: "r1", date: "2026-08-04" }]);
    expect(isDoneOn(daily, "2026-08-04", set)).toBe(true);
    expect(isDoneOn(daily, "2026-08-05", set)).toBe(false);
  });

  it("기록을 넘기지 않으면 미완료로 읽힌다", () => {
    expect(isDoneOn(daily, "2026-08-04")).toBe(false);
  });

  it("한 회차를 체크해도 다른 회차는 그대로다", () => {
    const set = buildCompletionSet([{ taskId: "r1", date: "2026-08-04" }]);
    expect(isDoneOn(daily, "2026-08-03", set)).toBe(false);
    expect(isDoneOn(daily, "2026-08-05", set)).toBe(false);
  });

  it("'전체 완료'는 성립하지 않는다 — 끝이 없을 수 있다", () => {
    expect(isTaskComplete(daily)).toBe(false);
  });

  it("기간형으로 취급하지 않는다 (endDate가 9999년이어도)", () => {
    expect(isMultiDay(daily)).toBe(false);
  });

  it("밀린 할일에 들어가지 않는다", () => {
    expect(overdueTasks([daily], "2027-01-01")).toEqual([]);
  });

  it("규칙이 맞는 날에만 목록에 뜬다", () => {
    const weekly = task({
      id: "r2",
      recurrence: { type: "weekly", daysOfWeek: [1] },
      endDate: NO_END_DATE,
    });
    expect(occursOn(weekly, MON)).toBe(true);
    expect(occursOn(weekly, "2026-08-04")).toBe(false);
    expect(tasksOnDate([weekly], MON).map((t) => t.id)).toEqual(["r2"]);
    expect(tasksOnDate([weekly], "2026-08-04")).toEqual([]);
  });

  it("달력 인덱스는 범위 안에서만 회차를 펼친다", () => {
    // 이 보호가 없으면 종료 없는 반복 하나가 300만 일을 순회한다
    const index = buildDateIndex([daily], {
      from: "2026-08-01",
      to: "2026-08-05",
    });
    expect(index.get("2026-08-02")).toBeUndefined(); // 시작 전
    expect(index.get("2026-08-03")?.map((t) => t.id)).toEqual(["r1"]);
    expect(index.get("2026-08-05")?.map((t) => t.id)).toEqual(["r1"]);
    expect(index.size).toBe(3);
  });

  it("매일 뜨는 것은 그날만의 할일 뒤로 간다", () => {
    const once = task({ id: "once" });
    const list = sortTasksForDate([daily, once], MON);
    expect(list.map((t) => t.id)).toEqual(["once", "r1"]);
  });

  it("상세 문구는 진행률이 아니라 규칙을 보여준다", () => {
    expect(taskDetailText(daily, MON)).toBe("매일");
  });

  it("기존 일반 할일은 아무것도 달라지지 않는다", () => {
    const plain = task({ id: "p", startDate: "2026-08-03", endDate: "2026-08-05" });
    expect(occursOn(plain, "2026-08-04")).toBe(true);
    expect(occursOn(plain, "2026-08-06")).toBe(false);
    expect(isMultiDay(plain)).toBe(true);
    expect(isDoneOn(plain, "2026-08-04")).toBe(false);
  });

  it("기존 daily 데이터도 그대로 동작한다", () => {
    const legacy = task({
      id: "d",
      startDate: "2026-08-03",
      endDate: "2026-08-05",
      checkMode: "daily",
      completedDates: ["2026-08-03"],
    });
    expect(isDoneOn(legacy, "2026-08-03")).toBe(true);
    expect(isDoneOn(legacy, "2026-08-04")).toBe(false);
    expect(taskDetailText(legacy, "2026-08-03")).toBe("1/3일");
  });
});
