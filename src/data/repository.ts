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
  TaskCompletion,
} from "@/domain/types";

/** 백업·복원이 다루는 저장소의 전부. 설정은 저장소 밖(uiStore)에 있어 여기 없다 */
export interface RepositorySnapshot {
  categories: Category[];
  tasks: Task[];
  completions: TaskCompletion[];
}

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

  /** 제목 부분 일치. 날짜 범위를 보지 않는다 — 검색은 지금 보는 달에 갇히면 안 된다 */
  searchTasks(query: string): Promise<Task[]>;

  /** 반복 일정의 날짜별 완료 기록 (range와 겹치는 것만) */
  listCompletions(range: DateRange): Promise<TaskCompletion[]>;
  /** 그 회차 하나만 켜고 끈다. 다른 날짜는 건드리지 않는다 */
  setCompletion(taskId: string, date: ISODate, done: boolean): Promise<void>;

  /** 백업 — 저장소 전체를 그대로 읽어낸다 */
  exportSnapshot(): Promise<RepositorySnapshot>;
  /**
   * 복원 — 기존 데이터를 전부 지우고 스냅샷으로 갈아 끼운다.
   * 중간에 실패해 절반만 남는 상태가 생기지 않아야 한다.
   */
  importSnapshot(snapshot: RepositorySnapshot): Promise<void>;
}

/**
 * id는 서버가 아니라 클라이언트가 만든다 (06-architecture 3.4).
 * 서버 응답을 기다려야 id가 생긴다면, 오프라인에서 만든 할일을 곧바로 수정할 수 없다.
 */
export function newId(): string {
  return crypto.randomUUID();
}
