"use client";

import { WEEKDAY_LABELS } from "@/domain/date";
import {
  describeRecurrence,
  WEEKDAY_DAYS,
  WEEKEND_DAYS,
} from "@/domain/recurrence";
import type { ISODate, RecurrenceRule, RecurrenceType } from "@/domain/types";

interface Props {
  value: RecurrenceRule;
  startDate: ISODate;
  onChange: (rule: RecurrenceRule) => void;
}

const TYPES: { type: RecurrenceType; label: string; hint?: string }[] = [
  { type: "daily", label: "매일" },
  { type: "weekdays", label: "평일", hint: "월·화·수·목·금" },
  { type: "weekend", label: "주말", hint: "토·일" },
  { type: "weekly", label: "매주" },
  { type: "monthly", label: "매월" },
  { type: "yearly", label: "매년" },
];

/** 매주에서 자주 쓰는 묶음 — 하나씩 일곱 번 누르지 않게 한다 */
const DAY_PRESETS: { label: string; days: readonly number[] }[] = [
  { label: "평일", days: WEEKDAY_DAYS },
  { label: "주말", days: WEEKEND_DAYS },
  { label: "매일", days: [0, 1, 2, 3, 4, 5, 6] },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * 반복 규칙 편집기.
 *
 * 종류를 바꿔도 종료일은 유지한다 — "9월까지 매일"을 "9월까지 평일"로 바꾸려는데
 * 종료일이 초기화되면 두 번 일하게 된다.
 */
export function RecurrenceEditor({ value, startDate, onChange }: Props) {
  function changeType(type: RecurrenceType) {
    const endDate = value.endDate;
    switch (type) {
      case "daily":
        onChange({ type: "daily", endDate });
        return;
      case "weekdays":
        onChange({ type: "weekdays", endDate });
        return;
      case "weekend":
        onChange({ type: "weekend", endDate });
        return;
      case "weekly": {
        // 시작일의 요일을 기본값으로 — 아무것도 안 고른 상태로 두면 규칙이 성립하지 않는다
        const day = new Date(
          Number(startDate.slice(0, 4)),
          Number(startDate.slice(5, 7)) - 1,
          Number(startDate.slice(8, 10)),
        ).getDay();
        const daysOfWeek =
          value.type === "weekly" && value.daysOfWeek.length > 0
            ? value.daysOfWeek
            : [day];
        onChange({ type: "weekly", daysOfWeek, endDate });
        return;
      }
      case "monthly":
        onChange({
          type: "monthly",
          dayOfMonth:
            value.type === "monthly"
              ? value.dayOfMonth
              : Number(startDate.slice(8, 10)),
          endDate,
        });
        return;
      case "yearly":
        onChange({
          type: "yearly",
          month:
            value.type === "yearly"
              ? value.month
              : Number(startDate.slice(5, 7)),
          dayOfMonth:
            value.type === "yearly"
              ? value.dayOfMonth
              : Number(startDate.slice(8, 10)),
          endDate,
        });
        return;
    }
  }

  function toggleDay(day: number) {
    if (value.type !== "weekly") return;
    const has = value.daysOfWeek.includes(day);
    const next = has
      ? value.daysOfWeek.filter((d) => d !== day)
      : [...value.daysOfWeek, day].sort((a, b) => a - b);
    // 요일을 전부 끄면 아무 날에도 뜨지 않는다. 마지막 하나는 남긴다
    if (next.length === 0) return;
    onChange({ ...value, daysOfWeek: next });
  }

  const hasEnd = value.endDate !== undefined;

  return (
    <div className="mt-[10px] rounded-[12px] bg-line-2 p-[12px]">
      <div
        role="radiogroup"
        aria-label="반복 주기"
        className="grid grid-cols-3 gap-[6px]"
      >
        {TYPES.map((t) => {
          const on = t.type === value.type;
          return (
            <button
              key={t.type}
              type="button"
              role="radio"
              aria-checked={on}
              // 평일·주말은 어떤 요일이 들어가는지 이름만으로는 갈린다.
              // 화면에는 줄을 늘리지 않고 읽는 사람에게만 알려준다
              aria-label={t.hint ? `${t.label} ${t.hint}` : t.label}
              onClick={() => changeType(t.type)}
              className="min-h-[44px] rounded-[9px] text-[12.5px] font-semibold transition-colors"
              style={{
                background: on ? "var(--ink)" : "var(--surface)",
                color: on ? "var(--surface)" : "var(--ink-2)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 고른 묶음에 어떤 요일이 들어가는지 눈으로도 확인시킨다 */}
      {(value.type === "weekdays" || value.type === "weekend") && (
        <p className="mt-[8px] text-[11px] text-ink-3">
          {value.type === "weekdays" ? "월·화·수·목·금" : "토·일"}에 반복됩니다.
          요일을 따로 고르려면 <b className="font-semibold text-ink-2">매주</b>를
          누르세요.
        </p>
      )}

      {value.type === "weekly" && (
        <div
          role="group"
          aria-label="요일 빠른 선택"
          className="mt-[10px] flex gap-[6px]"
        >
          {DAY_PRESETS.map((preset) => {
            const on =
              value.daysOfWeek.length === preset.days.length &&
              preset.days.every((d) => value.daysOfWeek.includes(d));
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...value, daysOfWeek: [...preset.days] })}
                className="min-h-[32px] flex-1 rounded-[8px] text-[11.5px] font-semibold transition-colors"
                style={{
                  background: on ? "var(--ink-2)" : "var(--surface)",
                  color: on ? "var(--surface)" : "var(--ink-3)",
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}

      {value.type === "weekly" && (
        <div
          role="group"
          aria-label="반복 요일"
          className="mt-[6px] grid grid-cols-7 gap-[4px]"
        >
          {WEEKDAY_LABELS.map((label, day) => {
            const on = value.daysOfWeek.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                aria-label={`${label}요일`}
                onClick={() => toggleDay(day)}
                className="flex min-h-[44px] items-center justify-center rounded-[9px] text-[12px] font-semibold transition-colors"
                style={{
                  background: on ? "var(--ink)" : "var(--surface)",
                  color: on ? "var(--surface)" : "var(--ink-3)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {value.type === "monthly" && (
        <label className="mt-[10px] flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-ink-2">며칠마다</span>
          <select
            value={value.dayOfMonth}
            onChange={(e) =>
              onChange({ ...value, dayOfMonth: Number(e.target.value) })
            }
            className="min-h-[44px] rounded-[9px] bg-surface px-[12px] text-[13.5px] font-semibold outline-none"
          >
            {MONTH_DAYS.map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
        </label>
      )}

      {value.type === "yearly" && (
        <div className="mt-[10px] flex items-center justify-between gap-3">
          <span className="text-[12.5px] text-ink-2">며칠에</span>
          <div className="flex gap-[6px]">
            <select
              aria-label="반복 월"
              value={value.month}
              onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
              className="min-h-[44px] rounded-[9px] bg-surface px-[12px] text-[13.5px] font-semibold outline-none"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
            <select
              aria-label="반복 일"
              value={value.dayOfMonth}
              onChange={(e) =>
                onChange({ ...value, dayOfMonth: Number(e.target.value) })
              }
              className="min-h-[44px] rounded-[9px] bg-surface px-[12px] text-[13.5px] font-semibold outline-none"
            >
              {MONTH_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {((value.type === "monthly" && value.dayOfMonth > 28) ||
        (value.type === "yearly" && value.dayOfMonth > 28)) && (
        <p className="mt-[6px] text-[10.5px] leading-[1.5] text-ink-3">
          해당 날짜가 없는 달에는 그 달의 마지막 날에 표시됩니다.
        </p>
      )}

      <div className="mt-[12px] border-t border-line pt-[10px]">
        <button
          type="button"
          role="switch"
          aria-checked={hasEnd}
          onClick={() => {
            if (hasEnd) {
              const { endDate: _drop, ...rest } = value;
              void _drop;
              onChange(rest as RecurrenceRule);
            } else {
              onChange({ ...value, endDate: startDate });
            }
          }}
          className="flex min-h-[44px] w-full items-center justify-between text-left"
        >
          <span className="text-[12.5px] text-ink-2">종료일 지정</span>
          <span
            aria-hidden
            className="ml-3 flex h-[24px] w-[42px] shrink-0 items-center rounded-full px-[3px] transition-colors"
            style={{ background: hasEnd ? "var(--ink)" : "#c8ccd1" }}
          >
            <span
              className="size-[18px] rounded-full bg-white transition-transform"
              style={{ transform: hasEnd ? "translateX(18px)" : "none" }}
            />
          </span>
        </button>

        {hasEnd ? (
          <input
            type="date"
            aria-label="반복 종료일"
            value={value.endDate}
            min={startDate}
            onChange={(e) =>
              e.target.value && onChange({ ...value, endDate: e.target.value })
            }
            className="mt-[6px] w-full rounded-[9px] bg-surface px-[12px] py-[11px] text-[13.5px] outline-none"
          />
        ) : (
          <p className="mt-[2px] text-[10.5px] text-ink-3">
            끄면 종료 없이 계속 반복됩니다.
          </p>
        )}
      </div>

      <p className="mt-[10px] text-[11px] font-semibold text-ink-2">
        {describeRecurrence(value)}
        {value.endDate ? ` · ${value.endDate}까지` : " · 종료 없음"}
      </p>
    </div>
  );
}
