import { describe, expect, it } from "vitest";
import {
  buildDateIndex,
  countCompleted,
  dailyProgress,
  filterTasks,
  isDoneOn,
  isMultiDay,
  isTaskComplete,
  overdueTasks,
  sortTasksForDate,
  taskDetailText,
  tasksOnDate,
  toggleCompletedDate,
} from "./task";
import type { Category, Task } from "./types";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    categoryId: "work",
    title: "할일",
    startDate: "2026-08-03",
    endDate: "2026-08-03",
    checkMode: "once",
    done: false,
    completedDates: [],
    sortOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

const categories: Category[] = [
  { id: "work", name: "직장", color: "mist", sortOrder: 0 },
  { id: "personal", name: "개인", color: "sage", sortOrder: 1 },
  { id: "family", name: "가족", color: "clay", sortOrder: 2 },
];

describe("완료 판정", () => {
  it("마감형은 done 하나로 결정된다", () => {
    expect(isTaskComplete(task({ done: false }))).toBe(false);
    expect(isTaskComplete(task({ done: true }))).toBe(true);
  });

  it("지속형은 기간의 모든 날짜가 체크돼야 완료다", () => {
    const t = task({
      checkMode: "daily",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      completedDates: ["2026-08-01", "2026-08-02"],
    });
    expect(isTaskComplete(t)).toBe(false);
    expect(isTaskComplete({ ...t, completedDates: [...t.completedDates, "2026-08-03"] })).toBe(true);
  });

  it("지속형은 날짜별로 체크 상태가 다르다", () => {
    const t = task({
      checkMode: "daily",
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      completedDates: ["2026-08-02"],
    });
    expect(isDoneOn(t, "2026-08-01")).toBe(false);
    expect(isDoneOn(t, "2026-08-02")).toBe(true);
  });

  it("마감형은 어느 날짜로 물어도 같은 답을 준다", () => {
    const t = task({ startDate: "2026-08-01", endDate: "2026-08-05", done: true });
    expect(isDoneOn(t, "2026-08-01")).toBe(true);
    expect(isDoneOn(t, "2026-08-05")).toBe(true);
  });

  it("기간 밖으로 밀려난 체크는 세지 않는다 (진행률이 100%를 넘지 않게)", () => {
    // 8/1~8/10 이던 할일의 기간을 8/1~8/3 으로 줄인 상황
    const t = task({
      checkMode: "daily",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      completedDates: ["2026-08-01", "2026-08-02", "2026-08-07", "2026-08-09"],
    });
    expect(countCompleted(t)).toBe(2);
    expect(dailyProgress(t)).toEqual({ done: 2, total: 3 });
  });

  it("토글은 원본을 바꾸지 않고 정렬된 배열을 돌려준다", () => {
    const t = task({ checkMode: "daily", completedDates: ["2026-08-05"] });
    const added = toggleCompletedDate(t, "2026-08-02");
    expect(added).toEqual(["2026-08-02", "2026-08-05"]);
    expect(t.completedDates).toEqual(["2026-08-05"]);
    expect(toggleCompletedDate({ ...t, completedDates: added }, "2026-08-05")).toEqual([
      "2026-08-02",
    ]);
  });
});

describe("날짜별 조회", () => {
  const tasks = [
    task({ id: "a", startDate: "2026-08-01", endDate: "2026-08-01" }),
    task({ id: "b", startDate: "2026-07-30", endDate: "2026-08-02" }),
    task({ id: "c", startDate: "2026-08-05", endDate: "2026-08-05" }),
  ];

  it("기간 중간에 낀 날짜도 포함한다", () => {
    expect(tasksOnDate(tasks, "2026-08-01").map((t) => t.id)).toEqual(["a", "b"]);
    expect(tasksOnDate(tasks, "2026-07-31").map((t) => t.id)).toEqual(["b"]);
    expect(tasksOnDate(tasks, "2026-08-03")).toEqual([]);
  });

  it("인덱스는 기간의 모든 날짜에 같은 할일을 넣는다", () => {
    const index = buildDateIndex(tasks);
    expect(index.get("2026-07-30")?.map((t) => t.id)).toEqual(["b"]);
    expect(index.get("2026-08-02")?.map((t) => t.id)).toEqual(["b"]);
    expect(index.get("2026-08-04")).toBeUndefined();
  });
});

describe("정렬", () => {
  const on = "2026-08-03";

  it("완료된 것이 뒤로 간다", () => {
    const list = [
      task({ id: "done", done: true }),
      task({ id: "todo", done: false }),
    ];
    expect(sortTasksForDate(list, on, categories).map((t) => t.id)).toEqual([
      "todo",
      "done",
    ]);
  });

  it("지속형은 같은 그룹 안에서 뒤로 간다", () => {
    const list = [
      task({ id: "daily", checkMode: "daily", startDate: "2026-08-01", endDate: "2026-08-31" }),
      task({ id: "once" }),
    ];
    expect(sortTasksForDate(list, on, categories).map((t) => t.id)).toEqual([
      "once",
      "daily",
    ]);
  });

  it("완료 여부가 지속형 여부보다 먼저다", () => {
    const list = [
      task({ id: "done-once", done: true }),
      task({
        id: "todo-daily",
        checkMode: "daily",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      }),
    ];
    expect(sortTasksForDate(list, on, categories).map((t) => t.id)).toEqual([
      "todo-daily",
      "done-once",
    ]);
  });

  it("카테고리 순서를 따르고 미분류는 맨 뒤다", () => {
    const list = [
      task({ id: "none", categoryId: null }),
      task({ id: "family", categoryId: "family" }),
      task({ id: "work", categoryId: "work" }),
    ];
    expect(sortTasksForDate(list, on, categories).map((t) => t.id)).toEqual([
      "work",
      "family",
      "none",
    ]);
  });
});

describe("필터", () => {
  const on = "2026-08-03";
  const list = [
    task({ id: "work", categoryId: "work" }),
    task({ id: "family", categoryId: "family" }),
    task({ id: "none", categoryId: null }),
    task({ id: "done", categoryId: "work", done: true }),
  ];

  it("숨긴 카테고리를 걸러낸다", () => {
    const r = filterTasks(list, { hiddenCategoryIds: ["work"], hideCompleted: false });
    expect(r.map((t) => t.id)).toEqual(["family", "none"]);
  });

  it("미분류도 숨길 수 있다", () => {
    const r = filterTasks(list, {
      hiddenCategoryIds: ["__none__"],
      hideCompleted: false,
    });
    expect(r.map((t) => t.id)).toEqual(["work", "family", "done"]);
  });

  it("완료 숨기기는 기본이 꺼짐이고, 켜면 완료가 빠진다", () => {
    expect(
      filterTasks(list, { hiddenCategoryIds: [], hideCompleted: false }),
    ).toHaveLength(4);
    expect(
      filterTasks(list, { hiddenCategoryIds: [], hideCompleted: true, on }).map(
        (t) => t.id,
      ),
    ).toEqual(["work", "family", "none"]);
  });

  it("지속형은 on이 있으면 그 날짜 기준으로, 없으면 전체 완료 기준으로 숨긴다", () => {
    const daily = task({
      id: "daily",
      checkMode: "daily",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      completedDates: ["2026-08-03"], // 오늘은 했지만 기간 전체는 미완
    });
    // 리스트: 오늘 체크했으니 숨긴다
    expect(
      filterTasks([daily], { hiddenCategoryIds: [], hideCompleted: true, on }),
    ).toEqual([]);
    // 달력: 기간 전체가 끝난 게 아니므로 남긴다
    expect(
      filterTasks([daily], { hiddenCategoryIds: [], hideCompleted: true }),
    ).toHaveLength(1);
  });
});

describe("밀린 할일", () => {
  const today = "2026-08-03";

  it("마감이 지난 미완료만 고른다", () => {
    const list = [
      task({ id: "overdue", endDate: "2026-07-30" }),
      task({ id: "overdue-done", endDate: "2026-07-30", done: true }),
      task({ id: "today", endDate: today }),
      task({ id: "future", endDate: "2026-08-10" }),
    ];
    expect(overdueTasks(list, today).map((t) => t.id)).toEqual(["overdue"]);
  });

  it("지속형은 밀림 대상이 아니다", () => {
    const list = [
      task({
        id: "daily",
        checkMode: "daily",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        completedDates: [],
      }),
    ];
    expect(overdueTasks(list, today)).toEqual([]);
  });
});

describe("표시 문자열", () => {
  it("하루짜리 마감형은 부가 정보가 없다", () => {
    expect(taskDetailText(task(), "2026-08-03")).toBeNull();
    expect(isMultiDay(task())).toBe(false);
  });

  it("기간형은 몇 일차인지 보여준다", () => {
    const t = task({ startDate: "2026-08-01", endDate: "2026-08-05" });
    expect(taskDetailText(t, "2026-08-03")).toBe("3/5일차");
  });

  it("지속형은 진행률을 보여준다", () => {
    const t = task({
      checkMode: "daily",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      completedDates: ["2026-08-01", "2026-08-02"],
    });
    expect(taskDetailText(t, "2026-08-03")).toBe("2/31일");
  });
});
