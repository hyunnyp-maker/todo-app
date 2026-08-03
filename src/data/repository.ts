/**
 * 저장소 인터페이스 — 06-architecture.md 3.3
 *
 * 게스트(localStorage)와 로그인(Supabase)의 차이를 이 인터페이스 하나로 흡수한다.
 * 위쪽(hooks·components)은 자기가 어느 모드인지 알지 못한다.
 */

import type {
  Category,
  CategoryDeleteMode,
  DateRange,
  ISODate,
  Task,
} from "@/domain/types";

export interface TodoRepository {
  listCategories(): Promise<Category[]>;
  /** id는 호출부(클라이언트)가 이미 채워서 넘긴다 */
  createCategory(category: Category): Promise<Category>;
  updateCategory(id: string, patch: Partial<Category>): Promise<Category>;
  deleteCategory(id: string, mode: CategoryDeleteMode): Promise<void>;

  /** range와 하루라도 겹치는 모든 할일 (기간형 포함) */
  listTasks(range: DateRange): Promise<Task[]>;
  /**
   * 마감이 지난 미완료 할일 (E5).
   * 달 조회와 별도인 이유: 6월에 밀린 할일은 8월 달력 범위에 들어오지 않는다.
   */
  listOverdue(today: ISODate): Promise<Task[]>;
  createTask(task: Task): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
}

/**
 * id는 서버가 아니라 클라이언트가 만든다 (06-architecture 3.4).
 * 서버 응답을 기다려야 id가 생긴다면, 오프라인에서 만든 할일을 곧바로 수정할 수 없다.
 */
export function newId(): string {
  return crypto.randomUUID();
}
