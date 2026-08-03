"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newId } from "@/data/repository";
import { addDays, dayCount } from "@/domain/date";
import { isDoneOn, toggleCompletedDate } from "@/domain/task";
import type { ISODate, Task } from "@/domain/types";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

export interface DraftTask {
  title: string;
  categoryId: string | null;
  startDate: ISODate;
  endDate?: ISODate;
  checkMode?: Task["checkMode"];
  memo?: string;
}

export function buildTask(draft: DraftTask): Task {
  const start = draft.startDate;
  const end = draft.endDate ?? start;
  return {
    id: newId(),
    categoryId: draft.categoryId,
    title: draft.title.trim(),
    memo: draft.memo,
    startDate: start <= end ? start : end,
    endDate: start <= end ? end : start,
    checkMode: draft.checkMode ?? "once",
    done: false,
    completedDates: [],
    sortOrder: Date.now() % 1_000_000,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 할일 변경 — 전부 낙관적 반영이다 (03-scenarios P11).
 * 서버 응답을 기다리지 않는다. 체크는 0ms에 화면이 바뀌어야 한다.
 *
 * 하나의 할일이 여러 달 캐시에 걸쳐 있을 수 있으므로
 * ["tasks", scope] 접두사로 걸리는 캐시를 모두 함께 고친다.
 */
export function useTaskMutations() {
  const repo = useRepository();
  const scope = useOwnerScope();
  const qc = useQueryClient();

  const patchCaches = (
    fn: (tasks: Task[]) => Task[],
    { includeOverdue = true } = {},
  ) => {
    qc.setQueriesData<Task[]>(
      {
        queryKey: queryKeys.tasksAll(scope),
        // 새로 만든 할일은 밀린 목록에 들어갈 리 없다.
        // 낙관적으로 끼워 넣으면 "밀린 할일 N"이 잠깐 틀린 숫자를 보인다
        predicate: (q) => includeOverdue || q.queryKey[2] !== "overdue",
      },
      (old) => (old ? fn(old) : old),
    );
  };

  const snapshot = () =>
    qc.getQueriesData<Task[]>({ queryKey: queryKeys.tasksAll(scope) });

  const restore = (snap: ReturnType<typeof snapshot>) => {
    for (const [key, data] of snap) qc.setQueryData(key, data);
  };

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: queryKeys.tasksAll(scope) });

  const create = useMutation({
    mutationFn: (task: Task) => repo.createTask(task),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasksAll(scope) });
      const snap = snapshot();
      patchCaches((tasks) => [...tasks, task], { includeOverdue: false });
      return { snap };
    },
    onError: (_e, _task, ctx) => ctx && restore(ctx.snap),
    onSettled: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Task> }) =>
      repo.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasksAll(scope) });
      const snap = snapshot();
      patchCaches((tasks) =>
        tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { snap };
    },
    onError: (_e, _vars, ctx) => ctx && restore(ctx.snap),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => repo.deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasksAll(scope) });
      const snap = snapshot();
      patchCaches((tasks) => tasks.filter((t) => t.id !== id));
      return { snap };
    },
    onError: (_e, _id, ctx) => ctx && restore(ctx.snap),
    onSettled: invalidate,
  });

  /**
   * 체크 토글.
   *   once  — done 하나를 뒤집는다
   *   daily — 그 날짜만 뒤집는다. 다른 날짜는 건드리지 않는다 (P10: 과거 날짜도 가능)
   */
  function toggle(task: Task, on: ISODate) {
    if (task.checkMode === "once") {
      update.mutate({ id: task.id, patch: { done: !task.done } });
    } else {
      update.mutate({
        id: task.id,
        patch: { completedDates: toggleCompletedDate(task, on) },
      });
    }
  }

  /**
   * 밀린 할일을 오늘로 옮긴다 (E5).
   * 기간의 길이는 유지한 채 통째로 민다 — 3일짜리가 하루로 줄어들면 계획이 왜곡된다.
   */
  function moveToToday(task: Task, today: ISODate) {
    const span = dayCount(task.startDate, task.endDate);
    update.mutate({
      id: task.id,
      patch: { startDate: addDays(today, -(span - 1)), endDate: today },
    });
  }

  return {
    createTask: (draft: DraftTask) => create.mutate(buildTask(draft)),
    updateTask: (id: string, patch: Partial<Task>) => update.mutate({ id, patch }),
    deleteTask: (id: string) => remove.mutate(id),
    toggle,
    moveToToday,
    isDoneOn,
  };
}
