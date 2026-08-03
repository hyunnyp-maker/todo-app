"use client";

import Link from "next/link";
import { Sheet } from "@/components/ui/Sheet";
import { getSupabaseClient } from "@/data/supabase/client";
import { useSession } from "@/hooks/useSession";
import { useSyncQueue } from "@/hooks/useSyncQueue";

interface Props {
  open: boolean;
  hideCompleted: boolean;
  onHideCompletedChange: (v: boolean) => void;
  onClose: () => void;
}

export function SettingsSheet({
  open,
  hideCompleted,
  onHideCompletedChange,
  onClose,
}: Props) {
  const { user, isConfigured } = useSession();
  const { pending } = useSyncQueue();

  async function signOut() {
    // 아직 서버로 못 보낸 변경이 있으면 로그아웃과 함께 사라진다 (요구사항 3.4)
    if (pending > 0) {
      const ok = window.confirm(
        `아직 서버에 보내지 못한 변경 ${pending}건이 있습니다.\n지금 로그아웃하면 그 변경은 사라집니다. 계속할까요?`,
      );
      if (!ok) return;
    }
    await getSupabaseClient()?.auth.signOut();
    onClose();
  }

  return (
    <Sheet open={open} title="설정" onClose={onClose}>
      <button
        type="button"
        role="switch"
        aria-checked={hideCompleted}
        onClick={() => onHideCompletedChange(!hideCompleted)}
        className="flex w-full items-center justify-between rounded-[10px] bg-line-2 px-[12px] py-[12px] text-left"
      >
        <span>
          <span className="text-[13.5px]">완료한 할일 숨기기</span>
          <span className="mt-[2px] block text-[11px] text-ink-3">
            꺼두면 오늘 무엇을 했는지 남습니다
          </span>
        </span>
        <span
          aria-hidden
          className="ml-3 flex h-[24px] w-[42px] shrink-0 items-center rounded-full px-[3px] transition-colors"
          style={{ background: hideCompleted ? "var(--ink)" : "#c8ccd1" }}
        >
          <span
            className="size-[18px] rounded-full bg-white transition-transform"
            style={{ transform: hideCompleted ? "translateX(18px)" : "none" }}
          />
        </span>
      </button>

      <div className="mt-[14px] border-t border-line pt-[14px]">
        {user ? (
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-[13px]">{user.email}</span>
              <span className="mt-[2px] block text-[11px] text-ink-3">
                기기 간 동기화 중
              </span>
            </span>
            <button
              type="button"
              onClick={signOut}
              className="shrink-0 rounded-[10px] bg-line-2 px-[12px] py-[8px] text-[12.5px]"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div>
            <p className="text-[13px]">게스트로 사용 중</p>
            <p className="mt-[2px] text-[11px] leading-[1.6] text-ink-3">
              이 브라우저에만 저장됩니다.
              {isConfigured
                ? " 로그인하면 다른 기기에서도 이어서 쓸 수 있어요."
                : " (Supabase를 설정하면 로그인이 켜집니다)"}
            </p>
            {isConfigured && (
              <Link
                href="/login"
                className="mt-[10px] inline-block rounded-[10px] px-[14px] py-[9px] text-[13px] font-medium"
                style={{ background: "var(--ink)", color: "#fff" }}
              >
                로그인 / 가입
              </Link>
            )}
          </div>
        )}
      </div>

      <p className="mt-[14px] text-[11px] leading-[1.6] text-ink-3">
        {pending > 0
          ? `서버에 보내지 못한 변경 ${pending}건이 대기 중입니다. 온라인이 되면 자동으로 전송됩니다.`
          : "오프라인에서도 쓸 수 있습니다. 연결이 돌아오면 자동으로 맞춰집니다."}
      </p>
    </Sheet>
  );
}
