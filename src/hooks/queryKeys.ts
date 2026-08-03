import type { ISOMonth } from "@/domain/types";

/** 쿼리 키 — 06-architecture 4.2. 할일은 달 단위로 캐시한다 */
export const queryKeys = {
  categories: (scope: string) => ["categories", scope] as const,
  tasks: (scope: string, month: ISOMonth) => ["tasks", scope, month] as const,
  /** 밀린 할일도 ["tasks", scope] 아래 둔다 — 낙관적 패치와 무효화가 함께 걸리도록 */
  overdue: (scope: string) => ["tasks", scope, "overdue"] as const,
  tasksAll: (scope: string) => ["tasks", scope] as const,

  /** 반복 회차 완료 기록. 할일과 캐시 수명이 달라 별도 접두사를 쓴다 */
  completions: (scope: string, month: ISOMonth) =>
    ["completions", scope, month] as const,
  completionsAll: (scope: string) => ["completions", scope] as const,

  /** 검색은 날짜 범위와 무관하다 — 달 캐시 아래 두면 달을 넘길 때마다 버려진다 */
  search: (scope: string, query: string) => ["search", scope, query] as const,
  searchAll: (scope: string) => ["search", scope] as const,
};
