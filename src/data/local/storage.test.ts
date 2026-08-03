import { describe, expect, it } from "vitest";
import { parseGuestData } from "./storage";
import type { GuestData } from "@/domain/types";

const valid: GuestData = {
  schemaVersion: 1,
  categories: [{ id: "c1", name: "직장", color: "blue", sortOrder: 0 }],
  tasks: [
    {
      id: "t1",
      categoryId: "c1",
      title: "보고서",
      startDate: "2026-08-03",
      endDate: "2026-08-05",
      checkMode: "once",
      done: false,
      completedDates: [],
      recurrence: null,
      reminder: "none",
      reminderTime: "09:00",
      sortOrder: 0,
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ],
  completions: [],
  migrationAsked: false,
};

describe("손상 복구", () => {
  it("정상 데이터를 그대로 읽는다", () => {
    expect(parseGuestData(JSON.stringify(valid))).toEqual(valid);
  });

  it("null·빈 문자열·깨진 JSON은 null을 돌려준다 (호출부가 초기화)", () => {
    expect(parseGuestData(null)).toBeNull();
    expect(parseGuestData("")).toBeNull();
    expect(parseGuestData("{ 이건 JSON이 아님")).toBeNull();
    expect(parseGuestData("[]")).toBeNull();
  });

  it("스키마 버전이 다르면 읽지 않는다", () => {
    expect(parseGuestData(JSON.stringify({ ...valid, schemaVersion: 99 }))).toBeNull();
  });

  it("깨진 항목만 버리고 나머지는 살린다", () => {
    const raw = JSON.stringify({
      ...valid,
      categories: [
        { id: "c1", name: "직장", color: "blue", sortOrder: 0 },
        { id: "c2", name: "이상한색", color: "형광핑크", sortOrder: 1 },
        { name: "id 없음", color: "green", sortOrder: 2 },
      ],
      tasks: [
        valid.tasks[0],
        { id: "t2", title: "날짜 없음" },
        { id: "t3", title: "", startDate: "2026-08-03", endDate: "2026-08-03" },
      ],
    });
    const parsed = parseGuestData(raw)!;
    expect(parsed.categories.map((c) => c.id)).toEqual(["c1"]);
    expect(parsed.tasks.map((t) => t.id)).toEqual(["t1"]);
  });

  it("파스텔 시절에 저장된 색은 새 키로 옮겨 읽는다", () => {
    const raw = JSON.stringify({
      ...valid,
      categories: [{ id: "c1", name: "직장", color: "mist", sortOrder: 0 }],
    });
    expect(parseGuestData(raw)!.categories[0].color).toBe("blue");
  });

  it("사라진 카테고리를 가리키는 할일은 미분류가 된다", () => {
    const raw = JSON.stringify({ ...valid, categories: [] });
    const parsed = parseGuestData(raw)!;
    expect(parsed.tasks[0].categoryId).toBeNull();
  });

  it("뒤집힌 기간은 버리지 않고 바로잡는다", () => {
    const raw = JSON.stringify({
      ...valid,
      tasks: [{ ...valid.tasks[0], startDate: "2026-08-10", endDate: "2026-08-01" }],
    });
    const parsed = parseGuestData(raw)!;
    expect(parsed.tasks[0].startDate).toBe("2026-08-01");
    expect(parsed.tasks[0].endDate).toBe("2026-08-10");
  });

  it("반복·알림·완료 기록이 없던 시절의 데이터도 그대로 읽는다", () => {
    // 기존 사용자의 localStorage에는 이 필드들이 아예 없다.
    // 여기서 버리면 쓰던 사람의 데이터가 통째로 날아간다
    const raw = JSON.stringify({
      schemaVersion: 1,
      categories: [{ id: "c1", name: "직장", color: "blue", sortOrder: 0 }],
      tasks: [
        {
          id: "t1",
          categoryId: "c1",
          title: "보고서",
          startDate: "2026-08-03",
          endDate: "2026-08-05",
          checkMode: "daily",
          done: false,
          completedDates: ["2026-08-03"],
          sortOrder: 0,
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      migrationAsked: false,
    });
    const parsed = parseGuestData(raw)!;
    expect(parsed.tasks[0].recurrence).toBeNull();
    expect(parsed.tasks[0].reminder).toBe("none");
    expect(parsed.tasks[0].reminderTime).toBe("09:00");
    expect(parsed.tasks[0].completedDates).toEqual(["2026-08-03"]);
    expect(parsed.completions).toEqual([]);
  });

  it("반복 규칙과 회차 완료 기록을 읽는다", () => {
    const raw = JSON.stringify({
      ...valid,
      tasks: [
        {
          ...valid.tasks[0],
          endDate: "9999-12-31",
          recurrence: { type: "weekly", daysOfWeek: [3, 1] },
        },
      ],
      completions: [
        { taskId: "t1", date: "2026-08-03" },
        { taskId: "없는할일", date: "2026-08-03" },
        { taskId: "t1", date: "어제" },
      ],
    });
    const parsed = parseGuestData(raw)!;
    expect(parsed.tasks[0].recurrence).toEqual({
      type: "weekly",
      daysOfWeek: [1, 3],
    });
    // 없는 할일을 가리키거나 형식이 깨진 기록은 버린다
    expect(parsed.completions).toEqual([{ taskId: "t1", date: "2026-08-03" }]);
  });

  it("규칙이 깨졌으면 반복 없는 할일로 되돌린다", () => {
    const raw = JSON.stringify({
      ...valid,
      tasks: [{ ...valid.tasks[0], recurrence: { type: "매주" } }],
    });
    const parsed = parseGuestData(raw)!;
    expect(parsed.tasks[0].recurrence).toBeNull();
    expect(parsed.tasks[0].endDate).toBe("2026-08-05");
  });

  it("completedDates에 섞인 잘못된 값은 걸러낸다", () => {
    const raw = JSON.stringify({
      ...valid,
      tasks: [
        {
          ...valid.tasks[0],
          checkMode: "daily",
          completedDates: ["2026-08-03", "어제", 42, null],
        },
      ],
    });
    expect(parseGuestData(raw)!.tasks[0].completedDates).toEqual(["2026-08-03"]);
  });
});
