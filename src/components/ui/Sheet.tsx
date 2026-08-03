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
      {/* 높이를 화면에 묶고 본문만 스크롤시킨다.
          제한이 없으면 내용이 길어질수록 시트가 위로 자라, 하단 정렬 때문에
          헤더가 화면 밖으로 밀려난다 — 닫기 버튼이 사라진 것처럼 보인다 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative mx-auto flex max-h-[88dvh] w-full max-w-[520px] flex-col rounded-t-[18px] bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgba(0,0,0,0.12)]"
      >
        <div className="flex flex-none items-center justify-between border-b border-line pl-[18px] pr-[8px] pb-[8px] pt-[10px]">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full text-[17px] leading-none text-ink-2"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-[18px] pt-[12px]">
          {children}
        </div>
      </div>
    </div>
  );
}
