"use client";

import { REMINDER_OPTIONS } from "@/domain/reminder";
import type { ReminderOffset } from "@/domain/types";
import { useNotificationPermission } from "@/hooks/useNotificationPermission";

interface Props {
  offset: ReminderOffset;
  time: string;
  onOffsetChange: (offset: ReminderOffset) => void;
  onTimeChange: (time: string) => void;
}

/**
 * 알림 설정 — 기본은 꺼짐.
 *
 * 권한 요청은 사용자가 '알림 없음'이 아닌 항목을 고른 순간에만 일어난다.
 * 앱을 켜자마자 권한 팝업을 띄우면 대부분 '차단'을 누르고, 그러면 두 번째 기회는 없다.
 */
export function ReminderEditor({
  offset,
  time,
  onOffsetChange,
  onTimeChange,
}: Props) {
  const { supported, granted, denied, request } = useNotificationPermission();
  const on = offset !== "none";

  async function pick(next: ReminderOffset) {
    onOffsetChange(next);
    if (next !== "none" && supported && !granted && !denied) {
      await request();
    }
  }

  return (
    <div className="mt-[10px]">
      <div
        role="radiogroup"
        aria-label="알림 시점"
        className="flex flex-wrap gap-[6px]"
      >
        {REMINDER_OPTIONS.map((o) => {
          const selected = o.value === offset;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => pick(o.value)}
              className="min-h-[44px] rounded-[10px] px-[12px] text-[12.5px] font-semibold transition-colors"
              style={{
                background: selected ? "var(--ink)" : "var(--line-2)",
                color: selected ? "var(--surface)" : "var(--ink-2)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {on && (
        <>
          <label className="mt-[12px] flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-ink-2">기준 시각</span>
            <input
              type="time"
              value={time}
              onChange={(e) => e.target.value && onTimeChange(e.target.value)}
              className="min-h-[44px] rounded-[10px] bg-line-2 px-[12px] text-[13.5px] font-semibold outline-none"
            />
          </label>

          {/* 지킬 수 없는 약속을 하지 않는다 — 한계를 먼저 말한다 */}
          {!supported ? (
            <p
              role="status"
              className="mt-[8px] text-[11px] leading-[1.6]"
              style={{ color: "var(--danger)" }}
            >
              이 브라우저는 알림을 지원하지 않습니다. 설정은 저장되지만 알림은
              울리지 않습니다.
            </p>
          ) : denied ? (
            <p
              role="status"
              className="mt-[8px] text-[11px] leading-[1.6]"
              style={{ color: "var(--danger)" }}
            >
              알림 권한이 차단돼 있습니다. 브라우저 주소창의 자물쇠 → 알림에서
              허용으로 바꾸면 울립니다.
            </p>
          ) : !granted ? (
            <p role="status" className="mt-[8px] text-[11px] leading-[1.6] text-ink-3">
              알림 권한을 아직 허용하지 않았습니다.{" "}
              <button
                type="button"
                onClick={() => void request()}
                className="underline underline-offset-2"
              >
                권한 요청
              </button>
            </p>
          ) : (
            <p className="mt-[8px] text-[11px] leading-[1.6] text-ink-3">
              앱이 열려 있을 때 울립니다. 탭을 완전히 닫으면 울리지 않습니다.
            </p>
          )}
        </>
      )}
    </div>
  );
}
