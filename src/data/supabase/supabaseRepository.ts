/**
 * 로그인 모드 저장소 — Supabase 구현.
 *
 * ⚠️ owner_id를 클라이언트가 지정하지 않는다.
 *    INSERT에는 컬럼 기본값 auth.uid()가, SELECT에는 RLS가 적용된다.
 *    .eq("owner_id", myId) 같은 하드코딩을 넣지 않는 이유는
 *    v2에서 공유가 열릴 때 그 한 줄이 남의 데이터를 계속 막아버리기 때문이다 (02-personas T5).
 */

import type { SupabaseClient } from "./client";
import type { TodoRepository } from "../repository";
import type {
  Category,
  CategoryDeleteMode,
  DateRange,
  ISODate,
  Task,
} from "@/domain/types";
import {
  fromCategory,
  fromCategoryPatch,
  fromTask,
  fromTaskPatch,
  toCategory,
  toTask,
  type CategoryRow,
  type TaskRow,
} from "./mappers";

function fail(message: string, error: { message: string } | null): never {
  throw new Error(`${message}: ${error?.message ?? "알 수 없는 오류"}`);
}

export class SupabaseRepository implements TodoRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listCategories(): Promise<Category[]> {
    const { data, error } = await this.db
      .from("categories")
      .select("id, name, color, sort_order")
      .order("sort_order", { ascending: true });
    if (error) fail("카테고리를 불러오지 못했습니다", error);
    return (data as CategoryRow[]).map(toCategory);
  }

  async createCategory(category: Category): Promise<Category> {
    const { data, error } = await this.db
      .from("categories")
      .insert(fromCategory(category))
      .select("id, name, color, sort_order")
      .single();
    if (error) fail("카테고리를 만들지 못했습니다", error);
    return toCategory(data as CategoryRow);
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<Category> {
    const { data, error } = await this.db
      .from("categories")
      .update(fromCategoryPatch(patch))
      .eq("id", id)
      .select("id, name, color, sort_order")
      .single();
    if (error) fail("카테고리를 수정하지 못했습니다", error);
    return toCategory(data as CategoryRow);
  }

  /**
   * orphan  — 카테고리만 지운다. tasks.category_id가 ON DELETE SET NULL이라 할일은 미분류로 남는다
   * cascade — 할일을 먼저 지우고 카테고리를 지운다
   */
  async deleteCategory(id: string, mode: CategoryDeleteMode): Promise<void> {
    if (mode === "cascade") {
      const { error } = await this.db.from("tasks").delete().eq("category_id", id);
      if (error) fail("할일을 지우지 못했습니다", error);
    }
    const { error } = await this.db.from("categories").delete().eq("id", id);
    if (error) fail("카테고리를 지우지 못했습니다", error);
  }

  /** 기간이 range와 하루라도 겹치면 포함한다 — 달을 넘는 할일이 사라지지 않게 */
  async listTasks(range: DateRange): Promise<Task[]> {
    const { data, error } = await this.db
      .from("tasks")
      .select("*")
      .lte("start_date", range.to)
      .gte("end_date", range.from);
    if (error) fail("할일을 불러오지 못했습니다", error);
    return (data as TaskRow[]).map(toTask);
  }

  async listOverdue(today: ISODate): Promise<Task[]> {
    const { data, error } = await this.db
      .from("tasks")
      .select("*")
      .eq("check_mode", "once") // 지속형은 밀림 대상이 아니다 (E5)
      .eq("done", false)
      .lt("end_date", today);
    if (error) fail("밀린 할일을 불러오지 못했습니다", error);
    return (data as TaskRow[]).map(toTask);
  }

  async createTask(task: Task): Promise<Task> {
    const { data, error } = await this.db
      .from("tasks")
      .insert(fromTask(task))
      .select("*")
      .single();
    if (error) fail("할일을 만들지 못했습니다", error);
    return toTask(data as TaskRow);
  }

  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    const { data, error } = await this.db
      .from("tasks")
      .update(fromTaskPatch(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("할일을 수정하지 못했습니다", error);
    return toTask(data as TaskRow);
  }

  async deleteTask(id: string): Promise<void> {
    const { error } = await this.db.from("tasks").delete().eq("id", id);
    if (error) fail("할일을 지우지 못했습니다", error);
  }
}
