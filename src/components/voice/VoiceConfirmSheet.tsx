"use client";

import { useState } from "react";
import { RecurrenceEditor } from "@/components/task/RecurrenceEditor";
import type { TaskDraft } from "@/components/task/TaskEditSheet";
import { Sheet } from "@/components/ui/Sheet";
import { describeRecurrence } from "@/domain/recurrence";
import { DEFAULT_REMINDER_TIME } from "@/domain/reminder";
import { taskDraftError } from "@/domain/task";
import type { ISODate, RecurrenceRule } from "@/domain/types";
import { formatTimeKo, type ParsedVoiceTodo } from "@/domain/voiceParse";
import { getPermission, requestPermission } from "@/lib/notifications";

interface Props {
  open: boolean;
  parsed: ParsedVoiceTodo;
  /** 날짜를 알아듣지 못했을 때 채울 값 — 지금 보고 있는 날짜 */
  fallbackDate: ISODate;
  categoryId: string | null;
  onClose: () => void;
  onRetry: () => void;
  onSave: (draft: TaskDraft) => void;
}

/**
 * 음성 인식 결과 확인 — 저장 전 마지막 관문.
 *
 * 인식과 파싱은 둘 다 틀릴 수 있다. 그래서 자동 저장하지 않는다.
 * 사용자가 저장을 누르기 전까지 이 화면은 아무것도 만들지 않는다.
 *
 * 모든 칸은 고칠 수 있다. 파싱이 실패한 칸도 마찬가지다 —
 * 잘못 들었을 때 처음부터 다시 말하게 하는 것보다 고쳐 쓰는 편이 빠르다.
 */
export function VoiceConfirmSheet({
  open,
  parsed,
  fallbackDate,
  categoryId,
  onClose,
  onRetry,
  onSave,
}: Props) {
  const [title, setTitle] = useState(parsed.title);
  const [startDate, setStartDate] = useState<ISODate>(
    parsed.startDate ?? parsed.endDate ?? fallbackDate,
  );
  const [endDate, setEndDate] = useState<ISODate>(
    parsed.endDate ?? parsed.startDate ?? fallbackDate,
  );
  const [time, setTime] = useState(parsed.time ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(
    parsed.recurrence ?? null,
  );

  const isRecurring = recurrence !== null;
  const error = taskDraftError({
    title,
    startDate,
    endDate,
    recurrence,
  });

  function setRecurring(on: boolean) {
    if (!on) {
      setRecurrence(null);
      return;
    }
    // 반복과 기간은 같이 쓰지 않는다 (상세 시트와 같은 규칙)
    setRecurrence({ type: "daily" });
    setEndDate(startDate);
  }

  function save() {
    if (error) return;
    // 시간을 넣었으면 그 시각에 알림이 울린다. 권한은 이 순간에만 묻는다
    if (time && getPermission() === "default") void requestPermission();

    onSave({
      title: title.trim(),
      categoryId,
      startDate,
      endDate: isRecurring ? startDate : endDate,
      checkMode: "once",
      recurrence,
      reminder: time ? "at" : "none",
      reminderTime: time || DEFAULT_REMINDER_TIME,
    });
  }

  return (
    <Sheet open={open} title="이렇게 저장할까요?" onClose={onClose}>
      <div className="rounded-[10px] bg-line-2 px-[12px] py-[10px]">
        <p className="text-[10.5px] text-ink-3">들은 내용</p>
        <p className="mt-[2px] text-[13px] leading-[1.5]">{parsed.rawText}</p>
      </div>

      {parsed.warnings.length > 0 && (
        <ul
          className="mt-[10px] flex flex-col gap-[4px] rounded-[10px] px-[12px] py-[9px]"
          style={{ background: "var(--red-bg)" }}
          aria-live="polite"
        >
          {parsed.warnings.map((w) => (
            <li
              key={w}
              className="text-[11.5px] leading-[1.5]"
              style={{ color: "var(--red-tx)" }}
            >
              {w}
            </li>
          ))}
        </ul>
      )}

      <Field label="제목" needsCheck={!parsed.confidence.title}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          aria-label="제목"
          aria-invalid={title.trim() === ""}
          placeholder="무엇을 할까요?"
          className="w-full rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[13.5px] outline-none"
        />
      </Field>

      <Field
        label={isRecurring ? "반복 시작일" : "시작 날짜"}
        needsCheck={!parsed.confidence.date}
      >
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            setStartDate(v);
            // 종료일을 앞질러 가면 같이 끌고 간다. 손대지 않은 칸 때문에 저장이 막히면 안 된다
            if (endDate < v) setEndDate(v);
          }}
          aria-label="시작 날짜"
          className="w-full rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[13.5px] outline-none"
        />
      </Field>

      {!isRecurring && (
        <Field label="종료 날짜">
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => e.target.value && setEndDate(e.target.value)}
            aria-label="종료 날짜"
            className="w-full rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[13.5px] outline-none"
          />
          <p className="mt-[4px] text-[10.5px] text-ink-3">
            시작일과 같으면 하루짜리 할일이 됩니다.
          </p>
        </Field>
      )}

      <Field label="시간" needsCheck={parsed.time !== undefined && !parsed.confidence.time}>
        <div className="flex items-center gap-[8px]">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            aria-label="시간"
            className="min-h-[44px] flex-1 rounded-[10px] bg-line-2 px-[12px] text-[13.5px] outline-none"
          />
          {time && (
            <button
              type="button"
              onClick={() => setTime("")}
              className="min-h-[44px] shrink-0 rounded-[10px] bg-line-2 px-[12px] text-[12px]"
            >
              지우기
            </button>
          )}
        </div>
        <p className="mt-[4px] text-[10.5px] leading-[1.5] text-ink-3">
          {time
            ? `${formatTimeKo(time)}에 알림이 울립니다. 앱이 열려 있을 때만 동작합니다.`
            : "시간을 넣으면 그 시각에 알림이 울립니다."}
        </p>
      </Field>

      <div className="mt-[14px] border-t border-line pt-[12px]">
        <button
          type="button"
          role="switch"
          aria-checked={isRecurring}
          onClick={() => setRecurring(!isRecurring)}
          className="flex min-h-[44px] w-full items-center justify-between text-left"
        >
          <span>
            <span className="text-[13px]">반복</span>
            <span className="mt-[1px] block text-[11px] text-ink-3">
              {recurrence ? describeRecurrence(recurrence) : "매일 · 평일 · 매주 · 매월"}
            </span>
          </span>
          <span
            aria-hidden
            className="ml-3 flex h-[24px] w-[42px] shrink-0 items-center rounded-full px-[3px] transition-colors"
            style={{ background: isRecurring ? "var(--ink)" : "#c8ccd1" }}
          >
            <span
              className="size-[18px] rounded-full bg-white transition-transform"
              style={{ transform: isRecurring ? "translateX(18px)" : "none" }}
            />
          </span>
        </button>

        {recurrence && (
          <RecurrenceEditor
            value={recurrence}
            startDate={startDate}
            onChange={setRecurrence}
          />
        )}
      </div>

      {error && (
        <p className="mt-[12px] text-[11.5px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div className="mt-[16px] flex items-center gap-[8px]">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] rounded-[10px] bg-line-2 px-[14px] text-[13px]"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] rounded-[10px] bg-line-2 px-[14px] text-[13px]"
        >
          다시 말하기
        </button>
        <button
          type="button"
          disabled={error !== null}
          onClick={save}
          className="ml-auto min-h-[44px] rounded-[10px] px-[18px] text-[13px] font-medium disabled:opacity-40"
          style={{ background: "var(--ink)", color: "var(--surface)" }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}

/** 라벨 + 파싱이 흔들린 칸의 표시 */
function Field({
  label,
  needsCheck,
  children,
}: {
  label: string;
  needsCheck?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-[12px]">
      <div className="mb-[4px] flex items-center gap-[6px]">
        <span className="text-[11px] text-ink-3">{label}</span>
        {needsCheck && (
          <span
            className="rounded-full px-[6px] py-[1px] text-[9.5px] font-bold"
            style={{ background: "var(--orange-cp)", color: "#ffffff" }}
          >
            확인 필요
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
