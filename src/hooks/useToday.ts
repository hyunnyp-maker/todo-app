"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "@/domain/date";
import type { ISODate } from "@/domain/types";

/** 오늘 날짜는 바뀌지 않는 값으로 취급한다 — 구독할 외부 이벤트가 없다 */
const subscribe = () => () => {};

/**
 * 오늘 날짜. 서버에서는 null을 돌려준다.
 *
 * 서버와 클라이언트의 시간대가 다르면 날짜가 하루 어긋나 하이드레이션이 깨진다.
 * useEffect + setState로 미루면 렌더가 한 번 더 도는데,
 * useSyncExternalStore는 서버 스냅샷을 따로 줄 수 있어 그 왕복이 없다.
 */
export function useToday(): ISODate | null {
  return useSyncExternalStore(
    subscribe,
    () => todayISO(),
    () => null,
  );
}
