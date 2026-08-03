"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { toneOf } from "@/domain/palette";
import type { Category, CheckMode, ISODate, Task } from "@/domain/types";

export interface TaskDraft {
  title: string;
  categoryId: string | null;
  startDate: ISODate;
  endDate: ISODate;
  checkMode: CheckMode;
}

interface Props {
  open: boolean;
  /** null이면 새 할일 */
  task: Task | null;
  initial: TaskDraft;
  categories: Category[];
  onClose: () => void;
  onSave: (draft: TaskDraft) => void;
  onDelete?: (task: Task) => void;
}

/**
 * 상세 시트 — 05-design 5.7
 *
 * 2단 접기가 P5의 구현체다.
 *   기본 경로:  제목 · 카테고리 · 날짜        ← 대부분의 할일은 하루짜리다
 *   1단 펼침:   + 종료일                     ← "기간으로 설정"을 켜야 나온다
 *   2단 펼침:   + 매일 체크                  ← 기간을 켠 뒤에야 나온다
 *
 * 처음부터 다 펼쳐두면 S1(회의 후 10초 입력)이 느려진다.
 */
export function TaskEditSheet({
  open,
  task,
  initial,
  categories,
  onClose,
  onSave,
  onDelete,
}: Props) {
  // initial은 마운트 시점에만 반영된다. 다시 열 때는 호출부가 key로 리마운트시킨다
  const [draft, setDraft] = useState<TaskDraft>(initial);
  const [isRange, setIsRange] = useState(initial.startDate !== initial.endDate);

  const titleOk = draft.title.trim() !== "";
  const rangeOk = draft.endDate >= draft.startDate;
  const canSave = titleOk && rangeOk;

  function setRange(on: boolean) {
    setIsRange(on);
    if (!on) {
      // 하루짜리는 항상 마감형이다 (요구사항 4.4.1)
      setDraft((d) => ({ ...d, endDate: d.startDate, checkMode: "once" }));
    }
  }

  return (
    <Sheet open={open} title={task ? "할일 수정" : "할일 추가"} onClose={onClose}>
      <label className="block text-[11px] text-ink-3">제목</label>
      <input
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        autoFocus
        className="mt-[4px] w-full rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[13.5px] outline-none"
        placeholder="무엇을 할까요?"
      />

      <label className="mt-[14px] block text-[11px] text-ink-3">카테고리</label>
      <div className="mt-[6px] flex flex-wrap gap-[6px]">
        {categories.map((c) => {
          const on = c.id === draft.categoryId;
          const tone = toneOf(c.color);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, categoryId: c.id }))}
              aria-pressed={on}
              className="rounded-full px-[10px] py-[5px] text-[11.5px] font-medium"
              style={
                on
                  ? { background: tone.bg, color: tone.tx, outline: `1.5px solid ${tone.dt}` }
                  : { background: "var(--line-2)", color: "var(--ink-3)" }
              }
            >
              {c.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, categoryId: null }))}
          aria-pressed={draft.categoryId === null}
          className="rounded-full px-[10px] py-[5px] text-[11.5px] font-medium"
          style={
            draft.categoryId === null
              ? {
                  background: toneOf(null).bg,
                  color: toneOf(null).tx,
                  outline: "1.5px solid var(--none-dt)",
                }
              : { background: "var(--line-2)", color: "var(--ink-3)" }
          }
        >
          미분류
        </button>
      </div>

      <label className="mt-[14px] block text-[11px] text-ink-3">
        {isRange ? "시작일" : "날짜"}
      </label>
      <input
        type="date"
        value={draft.startDate}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          setDraft((d) => ({
            ...d,
            startDate: v,
            endDate: isRange ? d.endDate : v,
          }));
        }}
        className="mt-[4px] w-full rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[13.5px] outline-none"
      />

      <div className="mt-[14px] border-t border-line pt-[12px]">
        <ToggleRow
          label="기간으로 설정"
          hint="여러 날에 걸친 할일"
          checked={isRange}
          onChange={setRange}
        />

        {isRange && (
          <div className="mt-[10px] pl-[10px]">
            <label className="block text-[11px] text-ink-3">종료일</label>
            <input
              type="date"
              value={draft.endDate}
              min={draft.startDate}
              onChange={(e) =>
                e.target.value &&
                setDraft((d) => ({ ...d, endDate: e.target.value }))
              }
              className="mt-[4px] w-full rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[13.5px] outline-none"
            />
            {!rangeOk && (
              <p className="mt-[6px] text-[11px]" style={{ color: "var(--danger)" }}>
                종료일이 시작일보다 앞설 수 없습니다
              </p>
            )}

            <div className="mt-[12px]">
              <ToggleRow
                label="매일 체크"
                hint="날짜마다 따로 체크하고 진행률을 봅니다"
                checked={draft.checkMode === "daily"}
                onChange={(on) =>
                  setDraft((d) => ({ ...d, checkMode: on ? "daily" : "once" }))
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-[18px] flex items-center justify-between">
        {task && onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(task)}
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
          disabled={!canSave}
          onClick={() => onSave({ ...draft, title: draft.title.trim() })}
          className="rounded-[10px] px-[16px] py-[9px] text-[13px] font-medium disabled:opacity-40"
          style={{ background: "var(--ink)", color: "#fff" }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between text-left"
    >
      <span>
        <span className="text-[13px]">{label}</span>
        <span className="mt-[1px] block text-[11px] text-ink-3">{hint}</span>
      </span>
      <span
        aria-hidden
        className="ml-3 flex h-[24px] w-[42px] shrink-0 items-center rounded-full px-[3px] transition-colors"
        style={{ background: checked ? "var(--ink)" : "#c8ccd1" }}
      >
        <span
          className="size-[18px] rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(18px)" : "none" }}
        />
      </span>
    </button>
  );
}
