/**
 * 게스트 → 계정 이관 — 요구사항 3.3
 *
 * 게스트로 쓰던 데이터가 로그인 순간 사라지면 안 된다.
 * 하윤에게 데이터는 잃으면 큰일이다 (02-personas T4).
 *
 * 원칙 셋
 *   1. 덮어쓰지 않고 병합한다 — 계정에 이미 데이터가 있어도 게스트 것을 얹는다
 *   2. 이름이 겹치면 기존 카테고리로 합친다 — 같은 이름을 두 개 만들지 않는다
 *   3. 하나라도 실패하면 localStorage를 비우지 않는다 — 다시 시도할 수 있게
 */

import { newId, type TodoRepository } from "../repository";
import { loadGuestData, saveGuestData } from "../local/storage";
import type { Category, GuestData, Task } from "@/domain/types";

export interface MigrationSummary {
  categories: number;
  tasks: number;
}

/** 이관 중 id가 새로 발급되므로, 완료 기록도 새 id로 옮겨야 짝이 맞는다 */
async function migrateCompletions(
  repo: TodoRepository,
  guest: GuestData,
  taskIdMap: Map<string, string>,
) {
  for (const record of guest.completions) {
    const mapped = taskIdMap.get(record.taskId);
    if (!mapped) continue;
    await repo.setCompletion(mapped, record.date, true);
  }
}

export function readGuestData(): GuestData {
  return loadGuestData();
}

/** 이관을 물어볼 만한 데이터가 있는가 */
export function hasMigratableData(data: GuestData): boolean {
  return !data.migrationAsked && data.tasks.length > 0;
}

/** "그냥 두기" — 데이터는 남기고 다시 묻지 않는다 */
export function skipMigration() {
  const data = loadGuestData();
  saveGuestData({ ...data, migrationAsked: true });
}

/**
 * 게스트 데이터를 계정으로 올린다.
 * 성공하면 localStorage를 비우고, 실패하면 그대로 둔다.
 */
export async function migrateGuestData(
  repo: TodoRepository,
): Promise<MigrationSummary> {
  const guest = loadGuestData();
  const existing = await repo.listCategories();

  // 이름 → 계정 카테고리 id
  const byName = new Map(existing.map((c) => [c.name.trim(), c.id]));
  const idMap = new Map<string, string>();
  let createdCategories = 0;

  let sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;

  for (const guestCategory of guest.categories) {
    const name = guestCategory.name.trim();
    const matched = byName.get(name);
    if (matched) {
      idMap.set(guestCategory.id, matched);
      continue;
    }
    const created: Category = {
      id: newId(),
      name,
      color: guestCategory.color,
      sortOrder: sortOrder++,
    };
    await repo.createCategory(created);
    byName.set(name, created.id);
    idMap.set(guestCategory.id, created.id);
    createdCategories += 1;
  }

  let createdTasks = 0;
  const taskIdMap = new Map<string, string>();
  for (const guestTask of guest.tasks) {
    const task: Task = {
      ...guestTask,
      // 게스트와 계정에서 같은 id가 쓰였을 수 있어 새로 만든다
      id: newId(),
      categoryId: guestTask.categoryId ? (idMap.get(guestTask.categoryId) ?? null) : null,
    };
    await repo.createTask(task);
    taskIdMap.set(guestTask.id, task.id);
    createdTasks += 1;
  }

  await migrateCompletions(repo, guest, taskIdMap);

  // 여기까지 왔으면 전부 성공했다
  saveGuestData({
    schemaVersion: 1,
    categories: [],
    tasks: [],
    completions: [],
    migrationAsked: true,
  });

  return { categories: createdCategories, tasks: createdTasks };
}
