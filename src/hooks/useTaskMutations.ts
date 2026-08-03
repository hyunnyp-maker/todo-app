"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newId } from "@/data/repository";
import { enqueue } from "@/data/sync/queue";
import type { NewQueueOp } from "@/data/sync/types";
import { addDays, dayCount } from "@/domain/date";
import {
  completionKey,
  recurrenceEndDate,
  type CompletionSet,
  EMPTY_COMPLETIONS,
} from "@/domain/recurrence";
import { DEFAULT_REMINDER_TIME } from "@/domain/reminder";
import { isDoneOn, toggleCompletedDate } from "@/domain/task";
import type {
  ISODate,
  RecurrenceRule,
  ReminderOffset,
  Task,
  TaskCompletion,
} from "@/domain/types";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

export interface DraftTask {
  title: string;
  categoryId: string | null;
  startDate: ISODate;
  endDate?: ISODate;
  checkMode?: Task["checkMode"];
  memo?: string;
  recurrence?: RecurrenceRule | null;
  reminder?: ReminderOffset;
  reminderTime?: string;
}

export function buildTask(draft: DraftTask): Task {
  const start = draft.startDate;
  const end = draft.endDate ?? start;
  const recurrence = draft.recurrence ?? null;
  return {
    id: newId(),
    categoryId: draft.categoryId,
    title: draft.title.trim(),
    memo: draft.memo,
    startDate: start <= end ? start : end,
    // 반복이 걸리면 종료일은 규칙이 정한다. 둘이 어긋나면 달력 조회에서 빠진다
    endDate: recurrence
      ? recurrenceEndDate(recurrence)
      : start <= end
        ? end
        : start,
    // 반복 일정은 회차별 완료 기록으로 판정한다. checkMode는 보지 않는다
    checkMode: recurrence ? "once" : (draft.checkMode ?? "once"),
    done: false,
    completedDates: [],
    recurrence,
    reminder: draft.reminder ?? "none",
    reminderTime: draft.reminderTime ?? DEFAULT_REMINDER_TIME,
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

  const patchCompletions = (
    fn: (rows: TaskCompletion[]) => TaskCompletion[],
  ) => {
    qc.setQueriesData<TaskCompletion[]>(
      { queryKey: queryKeys.completionsAll(scope) },
      (old) => (old ? fn(old) : old),
    );
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.tasksAll(scope) });
    // 검색 결과에도 방금 만든 할일이 반영돼야 한다
    qc.invalidateQueries({ queryKey: queryKeys.searchAll(scope) });
  };

  /**
   * 전송이 실패해도 화면을 되돌리지 않는다.
   * 큐에 담아두고 온라인이 되면 다시 보낸다 — 실패는 에러가 아니라 대기 상태다
   * (요구사항 3.5 규칙 3). 3회까지 실패하면 그때 최종 실패로 승격되고,
   * flush가 캐시를 무효화해 화면이 서버 상태로 돌아온다.
   */
  const queueOnError = (op: NewQueueOp) => () => enqueue(op);

  const create = useMutation({
    mutationFn: (task: Task) => repo.createTask(task),
    onMutate: async (task) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasksAll(scope) });
      patchCaches((tasks) => [...tasks, task], { includeOverdue: false });
    },
    onError: (_e, task) =>
      queueOnError({ kind: "task.create", entityId: task.id, payload: task })(),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Task> }) =>
      repo.updateTask(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasksAll(scope) });
      patchCaches((tasks) =>
        tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },
    onError: (_e, { id, patch }) =>
      queueOnError({ kind: "task.update", entityId: id, patch })(),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => repo.deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.tasksAll(scope) });
      patchCaches((tasks) => tasks.filter((t) => t.id !== id));
      patchCompletions((rows) => rows.filter((r) => r.taskId !== id));
    },
    onError: (_e, id) => queueOnError({ kind: "task.delete", entityId: id })(),
    onSuccess: invalidate,
  });

  /** 반복 일정의 그 회차 하나. 본체는 건드리지 않는다 */
  const completion = useMutation({
    mutationFn: ({
      taskId,
      date,
      done,
    }: {
      taskId: string;
      date: ISODate;
      done: boolean;
    }) => repo.setCompletion(taskId, date, done),
    onMutate: async ({ taskId, date, done }) => {
      await qc.cancelQueries({ queryKey: queryKeys.completionsAll(scope) });
      patchCompletions((rows) => {
        const rest = rows.filter(
          (r) => completionKey(r.taskId, r.date) !== completionKey(taskId, date),
        );
        return done ? [...rest, { taskId, date }] : rest;
      });
    },
    onError: (_e, { taskId, date, done }) =>
      queueOnError({
        kind: "task.completion",
        entityId: completionKey(taskId, date),
        taskId,
        date,
        done,
      })(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.completionsAll(scope) }),
  });

  /**
   * 체크 토글.
   *   반복  — 그 회차 하나만 별도 기록에 남긴다
   *   once  — done 하나를 뒤집는다
   *   daily — 그 날짜만 뒤집는다. 다른 날짜는 건드리지 않는다 (P10: 과거 날짜도 가능)
   */
  function toggle(
    task: Task,
    on: ISODate,
    completions: CompletionSet = EMPTY_COMPLETIONS,
  ) {
    if (task.recurrence) {
      completion.mutate({
        taskId: task.id,
        date: on,
        done: !isDoneOn(task, on, completions),
      });
      return;
    }
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
