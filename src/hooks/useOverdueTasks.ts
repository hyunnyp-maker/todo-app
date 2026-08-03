"use client";

import { useQuery } from "@tanstack/react-query";
import type { ISODate } from "@/domain/types";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

/** 밀린 할일 (E5). 표시 중인 달과 무관하게 전체에서 찾는다 */
export function useOverdueTasks(today: ISODate | null) {
  const repo = useRepository();
  const scope = useOwnerScope();

  const query = useQuery({
    queryKey: queryKeys.overdue(scope),
    queryFn: () => repo.listOverdue(today!),
    enabled: today !== null,
  });

  return { overdue: query.data ?? [] };
}
