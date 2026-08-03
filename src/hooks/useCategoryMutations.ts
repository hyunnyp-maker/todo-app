"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newId } from "@/data/repository";
import { enqueue } from "@/data/sync/queue";
import { nextSortOrder, normalizeCategoryName } from "@/domain/category";
import { suggestColor } from "@/domain/palette";
import type { Category, CategoryDeleteMode, PaletteKey } from "@/domain/types";
import { queryKeys } from "./queryKeys";
import { useOwnerScope, useRepository } from "./useRepository";

export function useCategoryMutations(existing: readonly Category[]) {
  const repo = useRepository();
  const scope = useOwnerScope();
  const qc = useQueryClient();

  const key = queryKeys.categories(scope);

  const patch = (fn: (list: Category[]) => Category[]) =>
    qc.setQueryData<Category[]>(key, (old) => (old ? fn(old) : old));

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: key });
    // 삭제는 할일의 categoryId도 바꾼다
    qc.invalidateQueries({ queryKey: queryKeys.tasksAll(scope) });
  };

  // 전송 실패는 대기 상태로 처리한다 (요구사항 3.5) — 화면을 되돌리지 않는다
  const create = useMutation({
    mutationFn: (category: Category) => repo.createCategory(category),
    onMutate: async (category) => {
      await qc.cancelQueries({ queryKey: key });
      patch((list) => [...list, category]);
    },
    onError: (_e, category) =>
      enqueue({ kind: "category.create", entityId: category.id, payload: category }),
    onSuccess: invalidateAll,
  });

  const update = useMutation({
    mutationFn: ({ id, patch: p }: { id: string; patch: Partial<Category> }) =>
      repo.updateCategory(id, p),
    onMutate: async ({ id, patch: p }) => {
      await qc.cancelQueries({ queryKey: key });
      patch((list) => list.map((c) => (c.id === id ? { ...c, ...p } : c)));
    },
    onError: (_e, { id, patch: p }) =>
      enqueue({ kind: "category.update", entityId: id, patch: p }),
    onSuccess: invalidateAll,
  });

  const remove = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: CategoryDeleteMode }) =>
      repo.deleteCategory(id, mode),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: key });
      patch((list) => list.filter((c) => c.id !== id));
    },
    onError: (_e, { id, mode }) =>
      enqueue({ kind: "category.delete", entityId: id, mode }),
    onSuccess: invalidateAll,
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => {
      const current = qc.getQueryData<Category[]>(key) ?? [];
      const bySortOrder = new Map(current.map((c) => [c.id, c.sortOrder]));
      // 순서가 실제로 바뀐 것만 저장한다
      for (let i = 0; i < ids.length; i++) {
        if (bySortOrder.get(ids[i]) !== i) {
          await repo.updateCategory(ids[i], { sortOrder: i });
        }
      }
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: key });
      const rank = new Map(ids.map((id, i) => [id, i]));
      patch((list) =>
        [...list]
          .map((c) => ({ ...c, sortOrder: rank.get(c.id) ?? c.sortOrder }))
          .sort((a, b) => a.sortOrder - b.sortOrder),
      );
    },
    onError: (_e, ids) =>
      ids.forEach((id, i) =>
        enqueue({ kind: "category.update", entityId: id, patch: { sortOrder: i } }),
      ),
    onSuccess: invalidateAll,
  });

  return {
    /** 색을 고르지 않아도 미사용 색이 자동 배정된다 (05-design 5.8) */
    createCategory: (name: string, color?: PaletteKey) =>
      create.mutate({
        id: newId(),
        name: normalizeCategoryName(name),
        color: color ?? suggestColor(existing.map((c) => c.color)),
        sortOrder: nextSortOrder(existing),
      }),
    renameCategory: (id: string, name: string) =>
      update.mutate({ id, patch: { name: normalizeCategoryName(name) } }),
    recolorCategory: (id: string, color: PaletteKey) =>
      update.mutate({ id, patch: { color } }),
    deleteCategory: (id: string, mode: CategoryDeleteMode) =>
      remove.mutate({ id, mode }),
    /** 밴드에서 드래그로 순서를 바꿨을 때. ids는 새 순서 */
    reorderCategories: (ids: string[]) => reorder.mutate(ids),
  };
}
