/**
 * 게스트 모드 저장소 — localStorage 구현.
 *
 * M6에서 SupabaseRepository가 추가되지만 이 구현은 남는다.
 * 게스트 모드는 프로토타입이 아니라 v1의 최종 기능이다 (요구사항 3.1).
 */

import { applyCategoryDelete } from "@/domain/category";
import { overlapsRange } from "@/domain/date";
import { completionKey } from "@/domain/recurrence";
import { searchTasksByTitle } from "@/domain/search";
import { overdueTasks } from "@/domain/task";
import type {
  Category,
  CategoryDeleteMode,
  DateRange,
  GuestData,
  ISODate,
  Task,
  TaskCompletion,
} from "@/domain/types";
import type { RepositorySnapshot, TodoRepository } from "../repository";
import { loadGuestData, saveGuestData } from "./storage";

export class LocalRepository implements TodoRepository {
  private read(): GuestData {
    return loadGuestData();
  }

  private write(data: GuestData) {
    saveGuestData(data);
  }

  async listCategories(): Promise<Category[]> {
    return [...this.read().categories].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async createCategory(category: Category): Promise<Category> {
    const data = this.read();
    data.categories.push(category);
    this.write(data);
    return category;
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<Category> {
    const data = this.read();
    const index = data.categories.findIndex((c) => c.id === id);
    if (index < 0) throw new Error(`카테고리를 찾을 수 없습니다: ${id}`);
    const next = { ...data.categories[index], ...patch, id };
    data.categories[index] = next;
    this.write(data);
    return next;
  }

  /**
   * 소속 할일이 있어도 삭제할 수 있다 (요구사항 4.3).
   *   orphan  — 할일은 미분류(categoryId: null)로 남긴다
   *   cascade — 할일도 함께 지운다
   */
  async deleteCategory(id: string, mode: CategoryDeleteMode): Promise<void> {
    const data = this.read();
    // 정책은 도메인 함수 하나만 안다 (domain/category.ts)
    const { categories, tasks } = applyCategoryDelete(
      data.categories,
      data.tasks,
      id,
      mode,
    );
    this.write({ ...data, categories, tasks });
  }

  /** 기간이 range와 하루라도 겹치면 포함한다 */
  async listTasks(range: DateRange): Promise<Task[]> {
    return this.read().tasks.filter((t) =>
      overlapsRange(t.startDate, t.endDate, range),
    );
  }

  async listOverdue(today: ISODate): Promise<Task[]> {
    return overdueTasks(this.read().tasks, today);
  }

  async createTask(task: Task): Promise<Task> {
    const data = this.read();
    data.tasks.push(task);
    this.write(data);
    return task;
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const data = this.read();
    const index = data.tasks.findIndex((t) => t.id === id);
    if (index < 0) throw new Error(`할일을 찾을 수 없습니다: ${id}`);
    const next = { ...data.tasks[index], ...patch, id };
    data.tasks[index] = next;
    this.write(data);
    return next;
  }

  async deleteTask(id: string): Promise<void> {
    const data = this.read();
    data.tasks = data.tasks.filter((t) => t.id !== id);
    // 할일이 사라지면 그 완료 기록도 함께 사라져야 한다 (DB의 on delete cascade와 같은 역할)
    data.completions = data.completions.filter((c) => c.taskId !== id);
    this.write(data);
  }

  async searchTasks(query: string): Promise<Task[]> {
    return searchTasksByTitle(this.read().tasks, query);
  }

  async listCompletions(range: DateRange): Promise<TaskCompletion[]> {
    return this.read().completions.filter(
      (c) => c.date >= range.from && c.date <= range.to,
    );
  }

  async setCompletion(
    taskId: string,
    date: ISODate,
    done: boolean,
  ): Promise<void> {
    const data = this.read();
    const key = completionKey(taskId, date);
    const rest = data.completions.filter(
      (c) => completionKey(c.taskId, c.date) !== key,
    );
    data.completions = done ? [...rest, { taskId, date }] : rest;
    this.write(data);
  }

  async exportSnapshot(): Promise<RepositorySnapshot> {
    const data = this.read();
    return {
      categories: data.categories,
      tasks: data.tasks,
      completions: data.completions,
    };
  }

  /**
   * 쓰기가 한 번뿐이라 중간 상태가 존재하지 않는다.
   * 실패하면 아무것도 바뀌지 않고, 성공하면 전부 바뀐다.
   */
  async importSnapshot(snapshot: RepositorySnapshot): Promise<void> {
    const data = this.read();
    this.write({
      schemaVersion: 1,
      categories: snapshot.categories,
      tasks: snapshot.tasks,
      completions: snapshot.completions,
      migrationAsked: data.migrationAsked,
    });
  }
}

export const localRepository = new LocalRepository();
