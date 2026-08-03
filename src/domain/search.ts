/**
 * 제목 검색 — 최소 기능.
 *
 * 대소문자를 구분하지 않고, 앞뒤 공백을 지운 뒤 부분 일치로 찾는다.
 * 일반 할일·기간형·반복 일정을 가리지 않는다 — 전부 같은 tasks에 있으므로
 * 여기서 따로 나눌 이유가 없다.
 */

import type { Task } from "./types";

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** query는 normalizeQuery를 거친 값이어야 한다 */
export function matchesQuery(task: Task, query: string): boolean {
  if (query === "") return true;
  return task.title.toLowerCase().includes(query);
}

/**
 * 검색어가 비면 원래 목록을 그대로 돌려준다 —
 * 공백만 친 순간 화면이 비어버리면 검색이 아니라 사고다.
 */
export function searchTasksByTitle(
  tasks: readonly Task[],
  query: string,
): Task[] {
  const normalized = normalizeQuery(query);
  if (normalized === "") return [...tasks];
  return tasks.filter((t) => matchesQuery(t, normalized));
}
