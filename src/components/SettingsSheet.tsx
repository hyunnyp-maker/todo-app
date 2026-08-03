"use client";

import Link from "next/link";
import { Brand } from "@/components/Brand";
import { BackupSection } from "@/components/settings/BackupSection";
import { Sheet } from "@/components/ui/Sheet";
import { getSupabaseClient } from "@/data/supabase/client";
import type { ThemeMode } from "@/domain/types";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";
import { useSession } from "@/hooks/useSession";
import { useSyncQueue } from "@/hooks/useSyncQueue";
import { promptInstall } from "@/lib/install";
import { playChime } from "@/lib/sound";

const THEMES: { mode: ThemeMode; label: string; hint: string }[] = [
  { mode: "light", label: "라이트", hint: "밝은 배경" },
  { mode: "dark", label: "다크", hint: "어두운 배경" },
  { mode: "system", label: "시스템", hint: "기기 설정" },
];

interface Props {
  open: boolean;
  hideCompleted: boolean;
  onHideCompletedChange: (v: boolean) => void;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  notifySound: boolean;
  onNotifySoundChange: (v: boolean) => void;
  onClose: () => void;
}

export function SettingsSheet({
  open,
  hideCompleted,
  onHideCompletedChange,
  theme,
  onThemeChange,
  notifySound,
  onNotifySoundChange,
  onClose,
}: Props) {
  const { user, isConfigured } = useSession();
  const { pending } = useSyncQueue();
  const { supported, granted, denied, request } = useNotificationPermission();
  const install = useInstallPrompt();

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
      <p className="mb-[6px] text-[11px] text-ink-3">화면 테마</p>
      <div className="mb-[14px] grid grid-cols-3 gap-[6px]">
        {THEMES.map((t) => {
          const on = t.mode === theme;
          return (
            <button
              key={t.mode}
              type="button"
              onClick={() => onThemeChange(t.mode)}
              aria-pressed={on}
              className="rounded-[10px] border px-[8px] py-[9px] text-center transition-colors"
              style={{
                background: on ? "var(--ink)" : "var(--line-2)",
                borderColor: on ? "var(--ink)" : "transparent",
                color: on ? "var(--surface)" : "var(--ink-2)",
              }}
            >
              <span className="block text-[12.5px] font-semibold">{t.label}</span>
              <span
                className="mt-[1px] block text-[10px]"
                style={{ color: on ? "var(--surface)" : "var(--ink-3)", opacity: on ? 0.7 : 1 }}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

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
                ? " 가입하면 이메일 계정 기준으로 저장돼, 다른 기기에서도 이어서 쓸 수 있어요."
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

      {/* 알림은 할일마다 켠다. 여기서는 상태와 한계만 알린다 */}
      <div className="mt-[14px] border-t border-line pt-[12px]">
        <p className="text-[13px]">알림</p>
        <p className="mt-[2px] text-[11px] leading-[1.6] text-ink-3">
          {!supported
            ? "이 브라우저는 알림을 지원하지 않습니다."
            : denied
              ? "권한이 차단돼 있습니다. 주소창의 자물쇠 → 알림에서 허용으로 바꿔 주세요."
              : granted
                ? "허용됨. 할일 상세에서 알림 시점을 고르면 울립니다. 앱이 열려 있을 때만 동작합니다 — 탭을 완전히 닫으면 울리지 않습니다."
                : "알림은 기본적으로 꺼져 있습니다. 할일 상세에서 알림을 켤 때 권한을 묻습니다."}
        </p>
        {supported && !granted && !denied && (
          <button
            type="button"
            onClick={() => void request()}
            className="mt-[8px] min-h-[44px] rounded-[10px] bg-line-2 px-[14px] text-[12.5px] font-semibold"
          >
            알림 권한 허용
          </button>
        )}

        <div className="mt-[10px] flex items-center gap-[8px]">
          <button
            type="button"
            role="switch"
            aria-checked={notifySound}
            onClick={() => {
              const next = !notifySound;
              onNotifySoundChange(next);
              // 켠 순간 한 번 들려준다. 이 탭이 자동재생 잠금을 푸는 사용자 제스처도 된다
              if (next) playChime();
            }}
            className="flex min-h-[44px] flex-1 items-center justify-between rounded-[10px] bg-line-2 px-[12px] text-left"
          >
            <span className="text-[13px]">알림 소리</span>
            <span
              aria-hidden
              className="ml-3 flex h-[24px] w-[42px] shrink-0 items-center rounded-full px-[3px] transition-colors"
              style={{ background: notifySound ? "var(--ink)" : "#c8ccd1" }}
            >
              <span
                className="size-[18px] rounded-full bg-white transition-transform"
                style={{ transform: notifySound ? "translateX(18px)" : "none" }}
              />
            </span>
          </button>
          <button
            type="button"
            onClick={() => playChime()}
            className="min-h-[44px] shrink-0 rounded-[10px] bg-line-2 px-[14px] text-[12.5px] font-semibold"
          >
            소리 듣기
          </button>
        </div>
      </div>

      {/* 음성 인식의 한계는 코드로 덮을 수 없다. 미리 말해 두는 편이 낫다 */}
      <div className="mt-[14px] border-t border-line pt-[12px]">
        <p className="text-[13px]">음성으로 추가</p>
        <p className="mt-[2px] text-[11px] leading-[1.6] text-ink-3">
          하단 입력 바의 마이크를 누르고 &lsquo;내일 오후 3시 병원 예약&rsquo;처럼
          말하면 제목·날짜·시간·반복을 분석해 확인 화면을 띄웁니다. 저장을 누르기
          전까지는 아무것도 만들어지지 않습니다.
        </p>
        <ul className="mt-[8px] flex list-disc flex-col gap-[3px] pl-[16px] text-[10.5px] leading-[1.6] text-ink-3">
          <li>Chrome·Edge에서 동작합니다. Firefox는 지원하지 않습니다.</li>
          <li>iOS·Safari는 지원 방식이 달라 중간 결과가 보이지 않을 수 있습니다.</li>
          <li>인식은 네트워크를 씁니다. 연결이 없으면 실패합니다.</li>
          <li>말한 내용이 항상 정확히 옮겨지지는 않습니다. 저장 전에 확인해 주세요.</li>
          <li>마이크 권한은 마이크 버튼을 누를 때만 요청합니다.</li>
        </ul>
      </div>

      <BackupSection />

      {/* 설치 유도 팝업은 띄우지 않는다 (E2). 설정에 들어온 사람에게만 보여준다 */}
      <div className="mt-[14px] border-t border-line pt-[12px]">
        <p className="text-[13px]">홈 화면에 추가</p>

        {install === "installed" ? (
          <p className="mt-[2px] text-[11px] leading-[1.6] text-ink-3">
            이미 홈 화면에서 실행 중입니다.
          </p>
        ) : install === "ios" ? (
          <>
            <p className="mt-[2px] text-[11px] leading-[1.6] text-ink-3">
              주소창 없이 앱처럼 열리고 오프라인에서도 실행됩니다. iOS는 버튼으로
              설치할 수 없어 직접 추가해야 합니다.
            </p>
            <ol className="mt-[8px] flex flex-col gap-[6px]">
              {[
                "Safari 하단(또는 상단)의 공유 버튼을 누릅니다",
                "목록을 내려 ‘홈 화면에 추가’를 고릅니다",
                "오른쪽 위 ‘추가’를 누릅니다",
              ].map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-[8px] text-[11.5px] leading-[1.5]"
                >
                  <span
                    aria-hidden
                    className="mt-[1px] flex size-[17px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: "var(--ink)", color: "var(--surface)" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-ink-2">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-[8px] text-[11px] leading-[1.6] text-ink-3">
              공유 버튼은 사각형에서 화살표가 위로 나온 모양입니다. 다른 브라우저의
              탭에서는 이 항목이 보이지 않을 수 있습니다 — Safari에서 열어 주세요.
            </p>
          </>
        ) : (
          <>
            <p className="mt-[2px] text-[11px] leading-[1.6] text-ink-3">
              주소창 없이 앱처럼 열립니다. 오프라인에서도 실행됩니다.
            </p>
            {install === "prompt" ? (
              <button
                type="button"
                onClick={() => void promptInstall()}
                className="mt-[8px] min-h-[44px] rounded-[10px] px-[14px] text-[12.5px] font-semibold"
                style={{ background: "var(--ink)", color: "var(--surface)" }}
              >
                홈 화면에 추가
              </button>
            ) : (
              <p className="mt-[6px] text-[11px] leading-[1.6] text-ink-3">
                브라우저 메뉴에서 &lsquo;홈 화면에 추가&rsquo; 또는 &lsquo;앱
                설치&rsquo;를 고르세요.
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-[16px] border-t border-line pt-[12px] text-center">
        <Brand />
      </div>
    </Sheet>
  );
}
