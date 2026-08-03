/**
 * 재시도 큐 저장소 — 요구사항 3.5
 *
 * localStorage에 남기는 이유: 오프라인에서 적은 할일이 브라우저를 닫으면 사라지면 안 된다.
 * 화면에는 이미 반영돼 있는데 서버에는 없는 상태가 조용히 굳어지는 게 최악이다.
 *
 * React가 구독할 수 있도록 스냅샷 + 리스너 구조로 둔다 (useSyncExternalStore).
 */

import { mergeQueue } from "./merge";
import type { NewQueueOp, QueueOp } from "./types";

const KEY_PREFIX = "todo-app:queue:";

let scope = "guest";
let ops: QueueOp[] = [];
let seq = 0;
let loaded = false;
let lastError: string | null = null;

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function storageKey() {
  return `${KEY_PREFIX}${scope}`;
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    if (ops.length === 0) window.localStorage.removeItem(storageKey());
    else window.localStorage.setItem(storageKey(), JSON.stringify(ops));
  } catch {
    // 용량 초과 등. 메모리 큐는 그대로 살아 있다
  }
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(storageKey());
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    ops = Array.isArray(parsed) ? (parsed as QueueOp[]) : [];
  } catch {
    ops = [];
  }
  seq = ops.reduce((max, o) => Math.max(max, o.seq), 0);
  loaded = true;
  notify();
}

/** 계정이 바뀌면 큐도 갈아끼운다. 남의 대기 항목을 내 계정으로 보내면 안 된다 */
export function setQueueScope(next: string) {
  if (scope === next && loaded) return;
  scope = next;
  loaded = false;
  lastError = null;
  load();
}

export function enqueue(op: NewQueueOp) {
  if (!loaded) load();
  ops = mergeQueue([...ops, { ...op, seq: ++seq, attempts: 0 } as QueueOp]);
  persist();
  notify();
}

export function getOps(): QueueOp[] {
  if (!loaded) load();
  return ops;
}

export function replaceOps(next: QueueOp[]) {
  ops = next;
  persist();
  notify();
}

export function clearQueue() {
  ops = [];
  lastError = null;
  persist();
  notify();
}

export function setLastError(message: string | null) {
  lastError = message;
  notify();
}

// ── React 구독 ────────────────────────────────

export interface QueueSnapshot {
  pending: number;
  lastError: string | null;
}

let snapshot: QueueSnapshot = { pending: 0, lastError: null };

function computeSnapshot(): QueueSnapshot {
  const pending = ops.length;
  // 값이 그대로면 같은 객체를 돌려줘야 useSyncExternalStore가 무한 렌더에 빠지지 않는다
  if (snapshot.pending !== pending || snapshot.lastError !== lastError) {
    snapshot = { pending, lastError };
  }
  return snapshot;
}

export function subscribeQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQueueSnapshot(): QueueSnapshot {
  return computeSnapshot();
}

const SERVER_SNAPSHOT: QueueSnapshot = { pending: 0, lastError: null };
export function getQueueServerSnapshot(): QueueSnapshot {
  return SERVER_SNAPSHOT;
}
