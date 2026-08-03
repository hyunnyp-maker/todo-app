/**
 * 게스트 모드 저장소 — localStorage 구현.
 *
 * M6에서 SupabaseRepository가 추가되지만 이 구현은 남는다.
 * 게스트 모드는 프로토타입이 아니라 v1의 최종 기능이다 (요구사항 3.1).
 */

import { applyCategoryDelete } from "@/domain/category";
import { overlapsRange } from "@/domain/date";
import { overdueTasks } from "@/domain/task";
import type {
  Category,
  CategoryDeleteMode,
  DateRange,
  GuestData,
  ISODate,
  Task,
} from "@/domain/types";
import type { TodoRepository } from "../repository";
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
    this.write(data);
  }
}

export const localRepository = new LocalRepository();
