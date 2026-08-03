/**
 * 카테고리 도메인 로직 — 요구사항 4.3
 *
 * 삭제 정책이 여기 있다. 저장소 구현(localStorage / Supabase)이 각자 만들지 않고
 * 이 함수를 부른다. 정책이 두 곳으로 갈라지면 반드시 어긋난다.
 */

import type {
  Category,
  CategoryDeleteMode,
  PaletteKey,
  Task,
} from "./types";

/** 미분류는 실제 레코드가 아니라 categoryId === null 을 화면에서 부르는 이름이다 */
export const UNCATEGORIZED_ID = "__none__";
export const UNCATEGORIZED_NAME = "미분류";

export const MAX_NAME_LENGTH = 20;

export function normalizeCategoryName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

export function isValidCategoryName(name: string): boolean {
  return normalizeCategoryName(name).length > 0;
}

export function nextSortOrder(categories: readonly Category[]): number {
  return categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
}

export function usedColors(categories: readonly Category[]): PaletteKey[] {
  return categories.map((c) => c.color);
}

/** 삭제 확인 다이얼로그가 "할일 N개"를 보여주기 위해 필요 */
export function countTasksIn(tasks: readonly Task[], categoryId: string): number {
  return tasks.filter((t) => t.categoryId === categoryId).length;
}

export interface DeleteResult {
  categories: Category[];
  tasks: Task[];
}

/**
 * 카테고리 삭제. 소속 할일이 있어도 삭제 자체는 막지 않는다.
 *
 *   orphan  — 할일은 살리고 미분류(null)로 옮긴다  ← 기본
 *   cascade — 할일도 함께 지운다
 */
export function applyCategoryDelete(
  categories: readonly Category[],
  tasks: readonly Task[],
  id: string,
  mode: CategoryDeleteMode,
): DeleteResult {
  return {
    categories: categories.filter((c) => c.id !== id),
    tasks:
      mode === "cascade"
        ? tasks.filter((t) => t.categoryId !== id)
        : tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
  };
}

/** 미분류 칩은 소속 할일이 0개면 화면에 내보내지 않는다 */
export function hasUncategorized(tasks: readonly Task[]): boolean {
  return tasks.some((t) => t.categoryId === null);
}
