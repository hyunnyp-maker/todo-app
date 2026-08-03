"use client";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <button
        type="button"
        aria-label="취소"
        onClick={onCancel}
        className="absolute inset-0 bg-black/25"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[320px] rounded-[16px] bg-surface p-[18px]"
      >
        <p className="text-[14px] font-semibold">{title}</p>
        {description && (
          <p className="mt-[6px] text-[12.5px] leading-[1.5] text-ink-2">
            {description}
          </p>
        )}
        <div className="mt-[16px] flex justify-end gap-[8px]">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[10px] px-[14px] py-[8px] text-[13px] text-ink-2"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[10px] px-[14px] py-[8px] text-[13px] font-medium"
            style={{
              color: danger ? "var(--danger)" : "var(--ink)",
              background: "var(--line-2)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
