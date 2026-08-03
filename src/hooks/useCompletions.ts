"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { monthGridRange } from "@/domain/date";
import { buildCompletionSet, type CompletionSet } from "@/domain/recurrence";
import type { ISOMonth } from "@/domain/types";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

/**
 * 반복 일정의 날짜별 완료 기록.
 *
 * 조회 범위는 할일과 똑같이 달력 그리드 범위다.
 * 화면에 보이지 않는 회차의 체크는 지금 알 필요가 없다.
 */
export function useCompletions(month: ISOMonth | null): {
  completions: CompletionSet;
} {
  const repo = useRepository();
  const scope = useOwnerScope();

  const query = useQuery({
    queryKey: queryKeys.completions(scope, month ?? "none"),
    queryFn: () => repo.listCompletions(monthGridRange(month!)),
    enabled: month !== null,
  });

  const rows = query.data;
  // Set 재생성은 카드 하나 체크할 때마다 일어난다. 배열이 그대로면 Set도 그대로 둔다
  const completions = useMemo(() => buildCompletionSet(rows ?? []), [rows]);

  return { completions };
}
