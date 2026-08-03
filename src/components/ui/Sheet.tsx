"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** 바텀 시트 — 모바일 우선이라 사이드 패널이 아니라 화면 전환으로 처리한다 (요구사항 2.1) */
export function Sheet({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/25"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto w-full max-w-[520px] rounded-t-[18px] bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgba(0,0,0,0.12)]"
      >
        <div className="flex items-center justify-between px-[18px] pb-[10px] pt-[14px]">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[13px] text-ink-3"
          >
            닫기
          </button>
        </div>
        <div className="px-[18px]">{children}</div>
      </div>
    </div>
  );
}
