"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  backupFileName,
  buildBackupFile,
  parseBackupFile,
  type BackupFile,
} from "@/domain/backup";
import { todayISO } from "@/domain/date";
import { useUiStore } from "@/stores/uiStore";
import { useOwnerScope, useRepository } from "./useRepository";

/**
 * 백업 · 복원.
 *
 * 내보내기는 저장소 전체 + 화면 설정을 한 파일로 묶는다.
 * 비밀번호·토큰·세션은 담지 않는다 — 백업 파일은 메신저로 오가기 마련이다.
 *
 * 가져오기는 병합이 아니라 전체 교체다. 호출부가 먼저 확인을 받는다.
 */
export function useBackup() {
  const repo = useRepository();
  const scope = useOwnerScope();
  const qc = useQueryClient();

  async function exportToFile(): Promise<string> {
    const snapshot = await repo.exportSnapshot();
    const ui = useUiStore.getState();
    const file = buildBackupFile(
      {
        categories: snapshot.categories,
        tasks: snapshot.tasks,
        completions: snapshot.completions,
        settings: {
          theme: ui.theme,
          hideCompleted: ui.hideCompleted,
          hiddenCategoryIds: ui.hiddenCategoryIds,
        },
      },
      new Date().toISOString(),
    );

    const name = backupFileName(todayISO());
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return name;
  }

  /** 파일을 읽고 검증만 한다. 여기서는 아무것도 덮어쓰지 않는다 */
  async function readFile(
    file: File,
  ): Promise<{ ok: true; file: BackupFile } | { ok: false; reason: string }> {
    let text: string;
    try {
      text = await file.text();
    } catch {
      return { ok: false, reason: "파일을 읽지 못했습니다." };
    }
    return parseBackupFile(text);
  }

  /** 검증을 통과한 파일만 들어온다. 저장소를 통째로 갈아 끼운다 */
  async function restore(backup: BackupFile): Promise<void> {
    await repo.importSnapshot({
      categories: backup.data.categories,
      tasks: backup.data.tasks,
      completions: backup.data.completions,
    });

    const ui = useUiStore.getState();
    ui.setHideCompleted(backup.data.settings.hideCompleted);
    ui.setTheme(backup.data.settings.theme);
    ui.setHiddenCategoryIds(backup.data.settings.hiddenCategoryIds);

    // 캐시에 남은 옛 데이터를 지운다. 새로 읽어야 화면이 복원된 상태가 된다
    await qc.invalidateQueries({ queryKey: ["tasks", scope] });
    await qc.invalidateQueries({ queryKey: ["categories", scope] });
    await qc.invalidateQueries({ queryKey: ["completions", scope] });
    await qc.invalidateQueries({ queryKey: ["search", scope] });
  }

  return { exportToFile, readFile, restore };
}
