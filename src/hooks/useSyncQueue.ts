"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { flushQueue } from "@/data/sync/flush";
import {
  getQueueServerSnapshot,
  getQueueSnapshot,
  setLastError,
  setQueueScope,
  subscribeQueue,
} from "@/data/sync/queue";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

/**
 * 대기 중인 변경을 화면에 알리고, 온라인이 되면 자동으로 다시 보낸다.
 */
export function useSyncQueue() {
  const repo = useRepository();
  const scope = useOwnerScope();
  const qc = useQueryClient();

  const snapshot = useSyncExternalStore(
    subscribeQueue,
    getQueueSnapshot,
    getQueueServerSnapshot,
  );

  useEffect(() => {
    setQueueScope(scope);
  }, [scope]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const result = await flushQueue(repo);
      if (cancelled) return;
      // 보냈든 버렸든 서버 상태를 다시 읽어 화면과 맞춘다
      if (result.sent > 0 || result.dropped > 0) {
        qc.invalidateQueries({ queryKey: queryKeys.tasksAll(scope) });
        qc.invalidateQueries({ queryKey: queryKeys.categories(scope) });
      }
    }

    // 앱을 켤 때 한 번, 그리고 온라인으로 돌아올 때마다
    void run();
    window.addEventListener("online", run);
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
    };
  }, [repo, scope, qc]);

  return {
    pending: snapshot.pending,
    lastError: snapshot.lastError,
    dismissError: () => setLastError(null),
  };
}
