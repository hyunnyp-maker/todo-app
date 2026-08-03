import { describe, expect, it } from "vitest";
import { matchesQuery, normalizeQuery, searchTasksByTitle } from "./search";
import { NO_END_DATE } from "./recurrence";
import type { Task } from "./types";

function task(id: string, title: string, over: Partial<Task> = {}): Task {
  return {
    id,
    categoryId: "work",
    title,
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

const tasks = [
  task("a", "주간 보고서"),
  task("b", "Weekly Report", { startDate: "2026-08-01", endDate: "2026-08-05" }),
  task("c", "운동", { recurrence: { type: "daily" }, endDate: NO_END_DATE }),
  task("d", "장보기"),
];

describe("검색어 정규화", () => {
  it("앞뒤 공백을 지우고 소문자로", () => {
    expect(normalizeQuery("  Report  ")).toBe("report");
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("제목 일치", () => {
  it("대소문자를 구분하지 않는다", () => {
    expect(matchesQuery(tasks[1], "weekly")).toBe(true);
    expect(matchesQuery(tasks[1], "WEEKLY".toLowerCase())).toBe(true);
  });

  it("부분 일치로 찾는다", () => {
    expect(matchesQuery(tasks[0], "보고")).toBe(true);
    expect(matchesQuery(tasks[0], "회의")).toBe(false);
  });
});

describe("검색", () => {
  it("일반 · 기간형 · 반복 일정을 가리지 않는다", () => {
    expect(searchTasksByTitle(tasks, "보고서").map((t) => t.id)).toEqual(["a"]);
    expect(searchTasksByTitle(tasks, "report").map((t) => t.id)).toEqual(["b"]);
    expect(searchTasksByTitle(tasks, "운동").map((t) => t.id)).toEqual(["c"]);
  });

  it("앞뒤 공백은 무시한다", () => {
    expect(searchTasksByTitle(tasks, "  장보기 ").map((t) => t.id)).toEqual(["d"]);
  });

  it("검색어가 없으면 원래 목록을 그대로 돌려준다", () => {
    // 공백만 쳤을 때 화면이 비면 검색이 아니라 사고다
    expect(searchTasksByTitle(tasks, "").map((t) => t.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(searchTasksByTitle(tasks, "   ")).toHaveLength(4);
  });

  it("맞는 게 없으면 빈 배열", () => {
    expect(searchTasksByTitle(tasks, "없는할일")).toEqual([]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    searchTasksByTitle(tasks, "보고서");
    expect(tasks).toHaveLength(4);
  });
});
