"use client";

import { formatDaySlash } from "@/domain/date";
import { toneOf } from "@/domain/palette";
import type { Category, ISODate, Task } from "@/domain/types";

interface Props {
  tasks: Task[];
  categories: Category[];
  open: boolean;
  today: ISODate;
  onToggleOpen: () => void;
  onMoveToToday: (task: Task) => void;
  onOpen: (task: Task) => void;
  /** M7의 "동기화 대기 N" 자리 */
  rightSlot?: React.ReactNode;
}

/**
 * 밀린 할일 — E5
 *
 * 기본은 접힘이다. 밀린 게 12개인 채로 화면이 채워지면 앱을 닫게 된다.
 * 개수만 보이고, 볼지 말지는 사용자가 정한다.
 *
 * 날짜를 자동으로 바꾸지 않는다. 7/28에 못 한 일이 8/3 것이 되면
 * "내가 그때 뭘 못 했는가"가 사라진다. [오늘로]를 눌렀을 때만 데이터가 바뀐다.
 */
export function OverdueFold({
  tasks,
  categories,
  open,
  onToggleOpen,
  onMoveToToday,
  onOpen,
  rightSlot,
}: Props) {
  if (tasks.length === 0) {
    return rightSlot ? (
      <div className="flex flex-none justify-end px-[15px] pb-[4px]">{rightSlot}</div>
    ) : null;
  }

  const byId = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="mx-3 mb-[8px] flex-none rounded-[11px] border border-dashed border-[#d8dbdf]">
      <div className="flex items-center justify-between px-[12px] py-[9px]">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex items-center gap-[6px] text-[11.5px] text-ink-2"
        >
          <span aria-hidden>{open ? "⌃" : "⌄"}</span>
          밀린 할일 <b className="font-semibold">{tasks.length}</b>
        </button>
        {rightSlot}
      </div>

      {open && (
        <ul className="flex flex-col gap-[6px] px-[10px] pb-[10px]">
          {tasks.map((task) => {
            const category = task.categoryId ? byId.get(task.categoryId) : undefined;
            const tone = toneOf(category?.color ?? null);
            return (
              <li
                key={task.id}
                className="flex items-center gap-[8px] rounded-[9px] border py-[8px] pl-[10px] pr-[10px]"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--card-border)",
                  borderLeft: `5px solid ${tone.dt}`,
                  color: "var(--ink)",
                }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[12.5px] font-semibold">
                    {task.title}
                  </span>
                  <span className="mt-[2px] block text-[10.5px] font-semibold">
                    <span style={{ color: tone.tx }}>{category?.name ?? "미분류"}</span>
                    <span className="font-medium" style={{ color: "var(--ink-3)" }}>
                      {" · "}
                      {formatDaySlash(task.endDate)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onMoveToToday(task)}
                  className="shrink-0 rounded-full px-[9px] py-[4px] text-[10.5px] font-semibold"
                  style={{ background: "var(--line-2)", color: "var(--ink-2)" }}
                >
                  오늘로
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
