import type { ISOMonth } from "@/domain/types";

/** 쿼리 키 — 06-architecture 4.2. 할일은 달 단위로 캐시한다 */
export const queryKeys = {
  categories: (scope: string) => ["categories", scope] as const,
  tasks: (scope: string, month: ISOMonth) => ["tasks", scope, month] as const,
  /** 밀린 할일도 ["tasks", scope] 아래 둔다 — 낙관적 패치와 무효화가 함께 걸리도록 */
  overdue: (scope: string) => ["tasks", scope, "overdue"] as const,
  tasksAll: (scope: string) => ["tasks", scope] as const,
};
