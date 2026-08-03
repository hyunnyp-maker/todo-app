/**
 * 큐 병합 — 요구사항 3.5 규칙 7
 *
 * 같은 항목을 여러 번 고치면 마지막 상태만 보내면 된다.
 * 오프라인에서 제목을 다섯 번 고쳤다고 요청을 다섯 번 보낼 이유가 없다.
 *
 * 병합 규칙
 *   create + update → create      (payload에 patch를 반영)
 *   create + delete → 둘 다 제거   (서버에 간 적이 없다)
 *   update + update → update      (patch 병합)
 *   update + delete → delete
 *   delete + 무엇이든 → delete 유지
 *
 * 서로 다른 항목 사이의 순서는 보존한다.
 * 카테고리를 만들고 그 안에 할일을 만들었다면 그 순서가 뒤집히면 안 된다.
 */

import type { QueueOp } from "./types";

function isCreate(op: QueueOp) {
  return op.kind === "task.create" || op.kind === "category.create";
}
function isUpdate(op: QueueOp) {
  return op.kind === "task.update" || op.kind === "category.update";
}
function isDelete(op: QueueOp) {
  return op.kind === "task.delete" || op.kind === "category.delete";
}

/** null = 두 연산이 상쇄되어 아무것도 보낼 필요가 없다 */
function mergePair(prev: QueueOp, next: QueueOp): QueueOp | null {
  if (isDelete(prev)) return prev; // 지운 것에는 더 할 일이 없다

  if (isCreate(prev)) {
    if (isDelete(next)) return null; // 만들었다 지웠다 → 서버는 몰라도 된다
    if (isUpdate(next) && "payload" in prev && "patch" in next) {
      return { ...prev, payload: { ...prev.payload, ...next.patch } } as QueueOp;
    }
    return prev;
  }

  if (isUpdate(prev)) {
    if (isDelete(next)) return next;
    if (isUpdate(next) && "patch" in prev && "patch" in next) {
      return { ...prev, patch: { ...prev.patch, ...next.patch } } as QueueOp;
    }
    return next;
  }

  return next;
}

/**
 * 큐 전체를 정규화한다.
 * 같은 entityId의 연산은 첫 등장 위치에서 하나로 합쳐진다.
 */
export function mergeQueue(ops: readonly QueueOp[]): QueueOp[] {
  const result: QueueOp[] = [];

  for (const op of ops) {
    const index = result.findIndex((o) => o.entityId === op.entityId);
    if (index < 0) {
      result.push(op);
      continue;
    }
    const merged = mergePair(result[index], op);
    if (merged === null) result.splice(index, 1);
    else result[index] = merged;
  }

  return result;
}
