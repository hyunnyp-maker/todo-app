/**
 * 큐 전송 — 요구사항 3.5 규칙 4·5
 *
 * seq 순서를 지켜 하나씩 보낸다. 중간에 실패하면 거기서 멈춘다.
 * 뒤 연산을 먼저 보내면 "만들기 전에 수정"이 되어 더 크게 망가진다.
 */

import type { TodoRepository } from "../repository";
import { getOps, replaceOps, setLastError } from "./queue";
import { MAX_ATTEMPTS, type QueueOp } from "./types";

async function applyOp(repo: TodoRepository, op: QueueOp): Promise<void> {
  switch (op.kind) {
    case "task.create":
      await repo.createTask(op.payload);
      return;
    case "task.update":
      await repo.updateTask(op.entityId, op.patch);
      return;
    case "task.delete":
      await repo.deleteTask(op.entityId);
      return;
    case "task.completion":
      await repo.setCompletion(op.taskId, op.date, op.done);
      return;
    case "category.create":
      await repo.createCategory(op.payload);
      return;
    case "category.update":
      await repo.updateCategory(op.entityId, op.patch);
      return;
    case "category.delete":
      await repo.deleteCategory(op.entityId, op.mode);
      return;
  }
}

export interface FlushResult {
  sent: number;
  remaining: number;
  /** 최종 실패해 버려진 연산 — 화면을 서버 상태로 되돌려야 한다 */
  dropped: number;
}

let running = false;

export async function flushQueue(repo: TodoRepository): Promise<FlushResult> {
  // 동시에 두 번 돌면 같은 연산을 두 번 보낸다
  if (running) return { sent: 0, remaining: getOps().length, dropped: 0 };
  running = true;

  let sent = 0;
  let dropped = 0;

  try {
    // 매 반복마다 큐를 다시 읽는다. 전송 중에 사용자가 새 조작을 할 수 있다
    for (;;) {
      const queue = getOps();
      if (queue.length === 0) break;

      const [head, ...rest] = queue;
      try {
        await applyOp(repo, head);
        replaceOps(rest);
        sent += 1;
      } catch (error) {
        const attempts = head.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          // 대기가 아니라 최종 실패다. 조용히 성공한 척하지 않는다
          replaceOps(rest);
          dropped += 1;
          setLastError(
            error instanceof Error ? error.message : "동기화에 실패했습니다",
          );
          continue;
        }
        replaceOps([{ ...head, attempts }, ...rest]);
        break; // 순서를 지키기 위해 여기서 멈춘다
      }
    }

    if (dropped === 0 && sent > 0) setLastError(null);
    return { sent, remaining: getOps().length, dropped };
  } finally {
    running = false;
  }
}
