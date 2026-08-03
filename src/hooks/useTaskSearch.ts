"use client";

import { useQuery } from "@tanstack/react-query";
import { normalizeQuery } from "@/domain/search";
import type { Task } from "@/domain/types";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

/**
 * 제목 검색.
 *
 * 달력이 보고 있는 달에 갇히지 않는다 — 저장소에 직접 묻는다.
 * "지난달에 적어둔 그거"를 못 찾으면 검색이 아니다.
 *
 * query는 이미 debounce를 거친 값이 들어온다 (SearchBar가 처리).
 */
export function useTaskSearch(query: string) {
  const repo = useRepository();
  const scope = useOwnerScope();
  const normalized = normalizeQuery(query);
  const active = normalized !== "";

  const result = useQuery({
    queryKey: queryKeys.search(scope, normalized),
    queryFn: () => repo.searchTasks(normalized),
    enabled: active,
    // 검색은 다시 여는 일이 잦다. 30초는 캐시로 답한다
    staleTime: 30_000,
  });

  return {
    active,
    results: (result.data ?? []) as Task[],
    isLoading: active && result.isLoading,
  };
}
