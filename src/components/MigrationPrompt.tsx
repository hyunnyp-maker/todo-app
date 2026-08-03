"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  hasMigratableData,
  migrateGuestData,
  readGuestData,
  skipMigration,
} from "@/data/migration/guestToAccount";
import { queryKeys } from "@/hooks/queryKeys";
import { useOwnerScope, useRepository } from "@/hooks/useRepository";
import { useSession } from "@/hooks/useSession";

/**
 * 로그인 직후 한 번만 뜨는 이관 안내 — 요구사항 3.3
 * "그냥 두기"를 고르면 다시 묻지 않는다.
 */
export function MigrationPrompt() {
  const { user } = useSession();
  const repo = useRepository();
  const scope = useOwnerScope();
  const qc = useQueryClient();

  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 렌더 중에 localStorage를 읽는다 — 클라이언트 전용 컴포넌트라 안전하다
  const guest = user && !dismissed ? readGuestData() : null;
  if (!user || dismissed || !guest || !hasMigratableData(guest)) return null;

  async function migrate() {
    setBusy(true);
    setError(null);
    try {
      await migrateGuestData(repo);
      qc.invalidateQueries({ queryKey: queryKeys.categories(scope) });
      qc.invalidateQueries({ queryKey: queryKeys.tasksAll(scope) });
      setDismissed(true);
    } catch (e) {
      // 실패하면 localStorage는 그대로 남아 있다. 다시 시도할 수 있다
      setError(e instanceof Error ? e.message : "가져오지 못했습니다");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    skipMigration();
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/25" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="게스트 데이터 가져오기"
        className="relative w-full max-w-[340px] rounded-[16px] bg-surface p-[18px]"
      >
        <p className="text-[14px] font-semibold">
          이 기기에 저장된 할일 {guest.tasks.length}개가 있어요
        </p>
        <p className="mt-[6px] text-[12.5px] leading-[1.6] text-ink-2">
          계정으로 가져올까요? 같은 이름의 카테고리는 하나로 합칩니다.
        </p>

        {error && (
          <p className="mt-[10px] text-[12px]" style={{ color: "var(--danger)" }}>
            {error} · 데이터는 그대로 있습니다
          </p>
        )}

        <div className="mt-[16px] flex justify-end gap-[8px]">
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="rounded-[10px] px-[14px] py-[9px] text-[13px] text-ink-2 disabled:opacity-40"
          >
            그냥 두기
          </button>
          <button
            type="button"
            onClick={migrate}
            disabled={busy}
            className="rounded-[10px] px-[14px] py-[9px] text-[13px] font-medium disabled:opacity-40"
            style={{ background: "var(--ink)", color: "#fff" }}
          >
            {busy ? "가져오는 중…" : "가져오기"}
          </button>
        </div>
      </div>
    </div>
  );
}
