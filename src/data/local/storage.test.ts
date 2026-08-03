import { describe, expect, it } from "vitest";
import { parseGuestData } from "./storage";
import type { GuestData } from "@/domain/types";

const valid: GuestData = {
  schemaVersion: 1,
  categories: [{ id: "c1", name: "직장", color: "mist", sortOrder: 0 }],
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
      sortOrder: 0,
      createdAt: "2026-08-01T00:00:00.000Z",
    },
  ],
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
        { id: "c1", name: "직장", color: "mist", sortOrder: 0 },
        { id: "c2", name: "이상한색", color: "형광핑크", sortOrder: 1 },
        { name: "id 없음", color: "sage", sortOrder: 2 },
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
