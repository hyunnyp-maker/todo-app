"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

export function useCategories() {
  const repo = useRepository();
  const scope = useOwnerScope();

  const query = useQuery({
    queryKey: queryKeys.categories(scope),
    queryFn: () => repo.listCategories(),
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
  };
}
