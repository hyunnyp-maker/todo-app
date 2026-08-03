/**
 * 재시도 큐 — 06-architecture.md 3.4 · 요구사항 3.5
 *
 * 오프라인이거나 전송이 실패했을 때 쌓아두고, 온라인이 되면 순서대로 다시 보낸다.
 * "에러"가 아니라 "대기 상태"다 — 사용자에게 재입력을 요구하지 않는다.
 */

import type {
  Category,
  CategoryDeleteMode,
  ISODate,
  Task,
} from "@/domain/types";

export type QueueOp =
  | { kind: "task.create"; seq: number; entityId: string; attempts: number; payload: Task }
  | { kind: "task.update"; seq: number; entityId: string; attempts: number; patch: Partial<Task> }
  | { kind: "task.delete"; seq: number; entityId: string; attempts: number }
  /** entityId는 "taskId#date" — 같은 회차를 여러 번 눌러도 하나로 합쳐진다 */
  | {
      kind: "task.completion";
      seq: number;
      entityId: string;
      attempts: number;
      taskId: string;
      date: ISODate;
      done: boolean;
    }
  | { kind: "category.create"; seq: number; entityId: string; attempts: number; payload: Category }
  | { kind: "category.update"; seq: number; entityId: string; attempts: number; patch: Partial<Category> }
  | {
      kind: "category.delete";
      seq: number;
      entityId: string;
      attempts: number;
      mode: CategoryDeleteMode;
    };

/** seq·attempts는 큐에 넣을 때 채워지므로 호출부는 나머지만 만든다 */
export type NewQueueOp =
  | { kind: "task.create"; entityId: string; payload: Task }
  | { kind: "task.update"; entityId: string; patch: Partial<Task> }
  | { kind: "task.delete"; entityId: string }
  | {
      kind: "task.completion";
      entityId: string;
      taskId: string;
      date: ISODate;
      done: boolean;
    }
  | { kind: "category.create"; entityId: string; payload: Category }
  | { kind: "category.update"; entityId: string; patch: Partial<Category> }
  | { kind: "category.delete"; entityId: string; mode: CategoryDeleteMode };

/** 이 횟수만큼 실패하면 대기가 아니라 최종 실패로 본다 (요구사항 3.5 규칙 5) */
export const MAX_ATTEMPTS = 3;
