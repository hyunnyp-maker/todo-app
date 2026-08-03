"use client";

import { useState } from "react";
import { ColorPalette } from "@/components/category/ColorPalette";
import { Sheet } from "@/components/ui/Sheet";
import { isValidCategoryName } from "@/domain/category";
import type { Category, CategoryDeleteMode, PaletteKey } from "@/domain/types";

interface Props {
  open: boolean;
  /** null이면 새 카테고리 */
  category: Category | null;
  /** 이 카테고리에 속한 할일 수 — 삭제 안내에 쓴다 */
  taskCount: number;
  usedColors: readonly PaletteKey[];
  suggestedColor: PaletteKey;
  onClose: () => void;
  /** 색을 탭하는 즉시 호출된다. 저장을 기다리지 않는 미리보기 (E4) */
  onPreviewColor: (color: PaletteKey) => void;
  onSave: (name: string, color: PaletteKey) => void;
  onDelete: (mode: CategoryDeleteMode) => void;
}

export function CategoryEditSheet({
  open,
  category,
  taskCount,
  usedColors,
  suggestedColor,
  onClose,
  onPreviewColor,
  onSave,
  onDelete,
}: Props) {
  const originalColor = category?.color ?? suggestedColor;
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState<PaletteKey>(originalColor);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function cancel() {
    // 미리보기로 바꿔둔 색을 원래대로 되돌린다
    if (category && color !== originalColor) onPreviewColor(originalColor);
    onClose();
  }

  function pick(next: PaletteKey) {
    setColor(next);
    // 기존 카테고리는 즉시 반영해 뒤의 카드·달력이 바로 바뀐다.
    // 새 카테고리는 아직 존재하지 않으므로 시트 안에서만 보여준다
    if (category) onPreviewColor(next);
  }

  return (
    <Sheet
      open={open}
      title={category ? "카테고리 편집" : "카테고리 추가"}
      onClose={cancel}
    >
      <label className="block text-[11px] text-ink-3">이름</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        autoFocus={!category}
        placeholder="직장, 개인, 가족…"
        className="mt-[4px] w-full rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[13.5px] outline-none"
      />

      <label className="mt-[14px] block text-[11px] text-ink-3">색</label>
      <div className="mt-[6px]">
        <ColorPalette
          value={color}
          used={usedColors.filter((c) => c !== originalColor)}
          onChange={pick}
        />
      </div>

      {!confirmingDelete ? (
        <div className="mt-[18px] flex items-center justify-between">
          {category ? (
            <button
              type="button"
              onClick={() => {
                if (taskCount === 0) onDelete("orphan");
                else setConfirmingDelete(true);
              }}
              className="rounded-[10px] px-[12px] py-[9px] text-[13px]"
              style={{ color: "var(--danger)" }}
            >
              삭제
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={!isValidCategoryName(name)}
            onClick={() => onSave(name, color)}
            className="rounded-[10px] px-[16px] py-[9px] text-[13px] font-medium disabled:opacity-40"
            style={{ background: "var(--ink)", color: "#fff" }}
          >
            {category ? "완료" : "추가"}
          </button>
        </div>
      ) : (
        // 소속 할일이 있어도 삭제 자체는 막지 않는다. 할일을 어떻게 할지만 고른다 (요구사항 4.3)
        <div className="mt-[18px] rounded-[12px] bg-line-2 p-[14px]">
          <p className="text-[13px] font-medium">
            &lsquo;{category?.name}&rsquo;에 할일 {taskCount}개가 있습니다
          </p>
          <div className="mt-[12px] flex flex-col gap-[8px]">
            <button
              type="button"
              onClick={() => onDelete("orphan")}
              className="rounded-[10px] bg-surface px-[12px] py-[11px] text-left text-[13px]"
            >
              할일은 남기고 <b>미분류로 옮기기</b>
              <span className="mt-[2px] block text-[11px] text-ink-3">
                할일은 그대로 있고 카테고리만 사라집니다
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete("cascade")}
              className="rounded-[10px] bg-surface px-[12px] py-[11px] text-left text-[13px]"
              style={{ color: "var(--danger)" }}
            >
              할일까지 <b>함께 삭제</b>
              <span className="mt-[2px] block text-[11px] text-ink-3">
                되돌릴 수 없습니다
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="mt-[10px] w-full py-[6px] text-[12px] text-ink-3"
          >
            취소
          </button>
        </div>
      )}
    </Sheet>
  );
}
