import { describe, expect, it } from "vitest";
import { mergeQueue } from "./merge";
import type { QueueOp } from "./types";
import type { Category, Task } from "@/domain/types";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    categoryId: "c1",
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

const category: Category = { id: "c1", name: "직장", color: "blue", sortOrder: 0 };

const create = (id: string, seq: number): QueueOp => ({
  kind: "task.create",
  seq,
  entityId: id,
  attempts: 0,
  payload: task({ id }),
});
const update = (id: string, seq: number, patch: Partial<Task>): QueueOp => ({
  kind: "task.update",
  seq,
  entityId: id,
  attempts: 0,
  patch,
});
const remove = (id: string, seq: number): QueueOp => ({
  kind: "task.delete",
  seq,
  entityId: id,
  attempts: 0,
});

describe("병합 규칙", () => {
  it("create + update → create (payload에 반영)", () => {
    const out = mergeQueue([create("t1", 1), update("t1", 2, { title: "고침" })]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("task.create");
    expect((out[0] as { payload: Task }).payload.title).toBe("고침");
  });

  it("create + delete → 둘 다 사라진다 (서버에 간 적이 없다)", () => {
    expect(mergeQueue([create("t1", 1), remove("t1", 2)])).toEqual([]);
  });

  it("update + update → patch가 합쳐진다", () => {
    const out = mergeQueue([
      update("t1", 1, { title: "A", done: true }),
      update("t1", 2, { title: "B" }),
    ]);
    expect(out).toHaveLength(1);
    expect((out[0] as { patch: Partial<Task> }).patch).toEqual({ title: "B", done: true });
  });

  it("update + delete → delete", () => {
    const out = mergeQueue([update("t1", 1, { title: "A" }), remove("t1", 2)]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("task.delete");
  });

  it("delete 뒤의 연산은 무시된다", () => {
    const out = mergeQueue([remove("t1", 1), update("t1", 2, { title: "A" })]);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("task.delete");
  });

  it("체크를 열 번 눌러도 한 번만 보낸다", () => {
    const ops = Array.from({ length: 10 }, (_, i) =>
      update("t1", i + 1, { done: i % 2 === 0 }),
    );
    const out = mergeQueue(ops);
    expect(out).toHaveLength(1);
    expect((out[0] as { patch: Partial<Task> }).patch.done).toBe(false); // 마지막 상태
  });
});

describe("반복 회차 체크", () => {
  const check = (taskId: string, date: string, seq: number, done: boolean): QueueOp => ({
    kind: "task.completion",
    seq,
    entityId: `${taskId}#${date}`,
    attempts: 0,
    taskId,
    date,
    done,
  });

  it("같은 회차를 여러 번 눌러도 마지막 상태만 보낸다", () => {
    const out = mergeQueue([
      check("t1", "2026-08-03", 1, true),
      check("t1", "2026-08-03", 2, false),
      check("t1", "2026-08-03", 3, true),
    ]);
    expect(out).toHaveLength(1);
    expect((out[0] as { done: boolean }).done).toBe(true);
  });

  it("다른 날짜의 체크는 따로 남는다", () => {
    const out = mergeQueue([
      check("t1", "2026-08-03", 1, true),
      check("t1", "2026-08-04", 2, true),
    ]);
    expect(out).toHaveLength(2);
  });

  it("할일을 지우면 그 할일의 회차 체크는 함께 사라진다", () => {
    // 남겨두면 외래키 위반으로 전송이 통째로 막힌다
    const out = mergeQueue([
      check("t1", "2026-08-03", 1, true),
      check("t2", "2026-08-03", 2, true),
      remove("t1", 3),
    ]);
    expect(out.map((o) => o.kind)).toEqual(["task.completion", "task.delete"]);
    expect(out[0].entityId).toBe("t2#2026-08-03");
  });
});

describe("순서 보존", () => {
  it("서로 다른 항목의 순서는 유지된다", () => {
    const out = mergeQueue([create("a", 1), create("b", 2), create("c", 3)]);
    expect(out.map((o) => o.entityId)).toEqual(["a", "b", "c"]);
  });

  it("카테고리 생성이 그 안의 할일 생성보다 앞선다", () => {
    // 이 순서가 뒤집히면 외래키 위반으로 전송이 통째로 실패한다
    const catCreate: QueueOp = {
      kind: "category.create",
      seq: 1,
      entityId: "c1",
      attempts: 0,
      payload: category,
    };
    const out = mergeQueue([catCreate, create("t1", 2), update("t1", 3, { title: "x" })]);
    expect(out.map((o) => o.entityId)).toEqual(["c1", "t1"]);
    expect(out[0].kind).toBe("category.create");
  });

  it("나중 연산이 병합돼도 첫 등장 위치를 지킨다", () => {
    const out = mergeQueue([
      create("a", 1),
      create("b", 2),
      update("a", 3, { title: "고침" }),
    ]);
    expect(out.map((o) => o.entityId)).toEqual(["a", "b"]);
  });

  it("빈 큐는 빈 배열", () => {
    expect(mergeQueue([])).toEqual([]);
  });

  it("원본 배열을 바꾸지 않는다", () => {
    const ops = [create("t1", 1), update("t1", 2, { title: "x" })];
    mergeQueue(ops);
    expect(ops).toHaveLength(2);
  });
});
