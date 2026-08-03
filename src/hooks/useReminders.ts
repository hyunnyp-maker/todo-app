"use client";

import { useEffect, useRef } from "react";
import { dueReminders, reminderLabel } from "@/domain/reminder";
import type { CompletionSet } from "@/domain/recurrence";
import { formatDayShort } from "@/domain/date";
import type { Task } from "@/domain/types";
import { loadFired, markFired, showNotification } from "@/lib/notifications";

/** 30초마다 확인한다. 1분 단위 알림에 이 정도면 충분하고 배터리도 아깝지 않다 */
const TICK_MS = 30_000;

/**
 * 알림 발송 루프.
 *
 * 권한이 없으면 아무것도 하지 않는다 — 여기서 권한을 요청하지 않는다.
 * 요청은 사용자가 설정에서 알림을 켤 때만 일어난다.
 *
 * 한계: 이 루프는 앱이 열려 있는 동안만 돈다. 탭을 닫으면 멈춘다.
 * 앱을 다시 열면 최근 2시간 안에 지나간 알림까지만 되살린다 (domain/reminder.ts).
 */
export function useReminders(
  tasks: readonly Task[],
  completions: CompletionSet,
  enabled: boolean,
) {
  // 할일 배열은 렌더마다 새 참조가 되기 쉽다.
  // 그때마다 타이머를 새로 걸면 30초 주기가 영영 채워지지 않는다
  const tasksRef = useRef(tasks);
  const completionsRef = useRef(completions);

  useEffect(() => {
    tasksRef.current = tasks;
    completionsRef.current = completions;
  }, [tasks, completions]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      const now = new Date();
      const due = dueReminders(
        tasksRef.current,
        now,
        loadFired(now.getTime()),
        completionsRef.current,
      );
      if (due.length === 0) return;

      const sent: string[] = [];
      for (const item of due) {
        const when =
          item.offset === "at"
            ? formatDayShort(item.date)
            : `${formatDayShort(item.date)} · ${reminderLabel(item.offset)}`;
        if (showNotification(item.title, when)) sent.push(item.key);
      }
      markFired(sent, now.getTime());
    };

    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
}
