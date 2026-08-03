import { describe, expect, it } from "vitest";
import {
  applyCategoryDelete,
  countTasksIn,
  hasUncategorized,
  isValidCategoryName,
  nextSortOrder,
  normalizeCategoryName,
} from "./category";
import {
  normalizePaletteKey,
  suggestColor,
  unusedColors,
  PALETTE_KEYS,
} from "./palette";
import type { Category, Task } from "./types";

const categories: Category[] = [
  { id: "work", name: "직장", color: "blue", sortOrder: 0 },
  { id: "personal", name: "개인", color: "green", sortOrder: 1 },
];

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t",
    categoryId: "work",
    title: "할일",
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

describe("이름", () => {
  it("앞뒤 공백을 없애고 20자로 자른다", () => {
    expect(normalizeCategoryName("  직장  ")).toBe("직장");
    expect(normalizeCategoryName("가".repeat(30))).toHaveLength(20);
  });

  it("공백만 있으면 유효하지 않다", () => {
    expect(isValidCategoryName("   ")).toBe(false);
    expect(isValidCategoryName("")).toBe(false);
    expect(isValidCategoryName(" 가족 ")).toBe(true);
  });
});

describe("정렬 순서", () => {
  it("가장 큰 값 다음을 준다", () => {
    expect(nextSortOrder(categories)).toBe(2);
    expect(nextSortOrder([])).toBe(0);
  });
});

describe("삭제 정책", () => {
  const tasks = [
    task({ id: "a", categoryId: "work" }),
    task({ id: "b", categoryId: "work" }),
    task({ id: "c", categoryId: "personal" }),
    task({ id: "d", categoryId: null }),
  ];

  it("소속 할일 개수를 센다", () => {
    expect(countTasksIn(tasks, "work")).toBe(2);
    expect(countTasksIn(tasks, "personal")).toBe(1);
  });

  it("orphan — 할일이 사라지지 않고 미분류가 된다", () => {
    const r = applyCategoryDelete(categories, tasks, "work", "orphan");
    expect(r.categories.map((c) => c.id)).toEqual(["personal"]);
    expect(r.tasks).toHaveLength(4);
    expect(r.tasks.filter((t) => t.categoryId === null).map((t) => t.id)).toEqual([
      "a",
      "b",
      "d",
    ]);
  });

  it("cascade — 소속 할일도 함께 지운다", () => {
    const r = applyCategoryDelete(categories, tasks, "work", "cascade");
    expect(r.tasks.map((t) => t.id)).toEqual(["c", "d"]);
  });

  it("다른 카테고리의 할일은 건드리지 않는다", () => {
    const r = applyCategoryDelete(categories, tasks, "work", "cascade");
    expect(r.tasks.find((t) => t.id === "c")?.categoryId).toBe("personal");
  });

  it("마지막 카테고리도 삭제된다", () => {
    const one: Category[] = [categories[0]];
    const r = applyCategoryDelete(one, [task({ id: "a" })], "work", "orphan");
    expect(r.categories).toEqual([]);
    expect(r.tasks[0].categoryId).toBeNull();
  });

  it("원본 배열을 바꾸지 않는다", () => {
    applyCategoryDelete(categories, tasks, "work", "cascade");
    expect(categories).toHaveLength(2);
    expect(tasks).toHaveLength(4);
  });

  it("미분류 존재 여부", () => {
    expect(hasUncategorized(tasks)).toBe(true);
    expect(hasUncategorized([task({ categoryId: "work" })])).toBe(false);
  });
});

describe("색 추천", () => {
  it("아직 안 쓴 색을 먼저 준다", () => {
    expect(suggestColor(["green", "pink"])).toBe("blue");
    expect(unusedColors(["green"])).not.toContain("green");
  });

  it("색을 다 쓰면 가장 적게 쓰인 색을 준다", () => {
    const used = [...PALETTE_KEYS, "green" as const];
    expect(unusedColors(used)).toEqual([]);
    // green만 2번, 나머지는 1번 → green이 아닌 색이 나와야 한다
    expect(suggestColor(used)).not.toBe("green");
  });
});

describe("옛 파스텔 키 이관", () => {
  it("파스텔 시절 키를 새 비비드 키로 옮긴다", () => {
    // 이미 저장된 카테고리 색이 사라지면 안 된다
    expect(normalizePaletteKey("mist")).toBe("blue");
    expect(normalizePaletteKey("sage")).toBe("green");
    expect(normalizePaletteKey("clay")).toBe("orange");
    expect(normalizePaletteKey("slate")).toBe("ink");
    expect(normalizePaletteKey("coral")).toBe("red");
  });

  it("새 키는 그대로 통과시킨다", () => {
    for (const key of PALETTE_KEYS) {
      expect(normalizePaletteKey(key)).toBe(key);
    }
  });

  it("알 수 없는 값은 null", () => {
    expect(normalizePaletteKey("형광핑크")).toBeNull();
    expect(normalizePaletteKey(42)).toBeNull();
    expect(normalizePaletteKey(null)).toBeNull();
  });
});
