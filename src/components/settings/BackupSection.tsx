"use client";

import { useRef, useState } from "react";
import type { BackupFile } from "@/domain/backup";
import { useBackup } from "@/hooks/useBackup";

type Status =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

/**
 * 백업 · 복원 — 설정 안의 한 칸.
 *
 * 복원은 되돌릴 수 없다. 그래서 순서를 셋으로 끊는다.
 *   1) 파일을 고른다 → 읽고 검증만 한다. 아직 아무것도 바뀌지 않는다
 *   2) 무엇이 들어 있고 무엇이 지워지는지 보여준다
 *   3) 사용자가 한 번 더 누른다
 */
export function BackupSection() {
  const { exportToFile, readFile, restore } = useBackup();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [staged, setStaged] = useState<BackupFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onExport() {
    setStatus({ kind: "busy" });
    try {
      const name = await exportToFile();
      setStatus({ kind: "done", message: `${name} 파일로 저장했습니다.` });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "내보내지 못했습니다.",
      });
    }
  }

  async function onPick(file: File | undefined) {
    setStaged(null);
    if (!file) return;
    setStatus({ kind: "busy" });
    const result = await readFile(file);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.reason });
      return;
    }
    setStaged(result.file);
    setStatus({ kind: "idle" });
  }

  async function onRestore() {
    if (!staged) return;
    setStatus({ kind: "busy" });
    try {
      await restore(staged);
      setStatus({
        kind: "done",
        message: `할일 ${staged.data.tasks.length}개를 복원했습니다.`,
      });
      setStaged(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "복원하지 못했습니다.",
      });
    }
  }

  function cancel() {
    setStaged(null);
    setStatus({ kind: "idle" });
    if (fileRef.current) fileRef.current.value = "";
  }

  const busy = status.kind === "busy";

  return (
    <div className="mt-[14px] border-t border-line pt-[14px]">
      <p className="text-[13px]">데이터 백업</p>
      <p className="mt-[2px] text-[11px] leading-[1.6] text-ink-3">
        카테고리·할일·반복·완료 기록과 화면 설정을 JSON 파일 하나로 내보냅니다.
        비밀번호나 로그인 정보는 담기지 않습니다.
      </p>

      <div className="mt-[10px] flex gap-[8px]">
        <button
          type="button"
          onClick={onExport}
          disabled={busy}
          className="min-h-[44px] flex-1 rounded-[10px] bg-line-2 px-[12px] text-[12.5px] font-semibold disabled:opacity-40"
        >
          내보내기
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="min-h-[44px] flex-1 rounded-[10px] bg-line-2 px-[12px] text-[12.5px] font-semibold disabled:opacity-40"
        >
          가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => void onPick(e.target.files?.[0])}
          className="hidden"
          aria-hidden
          tabIndex={-1}
        />
      </div>

      {staged && (
        <div
          role="alertdialog"
          aria-label="복원 확인"
          className="mt-[10px] rounded-[12px] p-[14px]"
          style={{ background: "var(--line-2)" }}
        >
          <p className="text-[12.5px] font-semibold">
            지금 데이터를 모두 지우고 이 파일로 바꿉니다
          </p>
          <p className="mt-[6px] text-[11px] leading-[1.6] text-ink-3">
            카테고리 {staged.data.categories.length}개 · 할일{" "}
            {staged.data.tasks.length}개 · 완료 기록{" "}
            {staged.data.completions.length}개
            {staged.exportedAt && (
              <>
                <br />
                내보낸 시각 {staged.exportedAt.slice(0, 10)}
              </>
            )}
            <br />
            기존 데이터와 합치지 않습니다. 되돌릴 수 없습니다.
          </p>
          <div className="mt-[12px] flex gap-[8px]">
            <button
              type="button"
              onClick={cancel}
              className="min-h-[44px] flex-1 rounded-[10px] bg-surface px-[12px] text-[12.5px]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onRestore}
              disabled={busy}
              className="min-h-[44px] flex-1 rounded-[10px] px-[12px] text-[12.5px] font-semibold text-white disabled:opacity-40"
              style={{ background: "var(--danger)" }}
            >
              덮어쓰기
            </button>
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <p
          role="alert"
          className="mt-[8px] text-[11px] leading-[1.6]"
          style={{ color: "var(--danger)" }}
        >
          {status.message}
        </p>
      )}
      {status.kind === "done" && (
        <p role="status" className="mt-[8px] text-[11px] leading-[1.6] text-ink-2">
          {status.message}
        </p>
      )}
    </div>
  );
}
