"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { addMonths, monthGridRange } from "@/domain/date";
import type { ISOMonth } from "@/domain/types";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

/**
 * 표시 중인 달의 할일.
 *
 * 조회 범위는 달이 아니라 "달력 그리드 범위"다 (7/26 ~ 9/5).
 * 달력에 보이는 이전/다음 달 칸에도 점을 찍어야 하기 때문.
 */
export function useTasks(month: ISOMonth | null) {
  const repo = useRepository();
  const scope = useOwnerScope();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.tasks(scope, month ?? "none"),
    queryFn: () => repo.listTasks(monthGridRange(month!)),
    enabled: month !== null,
  });

  // 인접 달을 미리 가져둔다 — 스와이프로 넘길 때 비어 보이지 않게 (06-architecture 6장)
  useEffect(() => {
    if (!month) return;
    for (const delta of [-1, 1]) {
      const target = addMonths(month, delta);
      queryClient.prefetchQuery({
        queryKey: queryKeys.tasks(scope, target),
        queryFn: () => repo.listTasks(monthGridRange(target)),
      });
    }
  }, [month, scope, queryClient, repo]);

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
  };
}
