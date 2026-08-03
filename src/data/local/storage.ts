/**
 * 게스트 모드 localStorage — 요구사항 4.5 · F6-4
 *
 * 원칙: 저장 데이터가 깨져도 앱은 죽지 않는다.
 * 파싱 실패·스키마 불일치 시 흰 화면 대신 초기 상태로 복구한다.
 *
 * 파싱은 domain/parse.ts가 맡는다 — 백업 파일과 같은 규칙으로 읽기 위해.
 */

import {
  isRecord,
  parseCategory,
  parseCompletion,
  parseTask,
  pruneCompletions,
  reattachOrphans,
} from "@/domain/parse";
import type { Category, GuestData, Task, TaskCompletion } from "@/domain/types";
import { seedGuestData } from "./seed";

export const STORAGE_KEY = "todo-app:guest:v1";
const SCHEMA_VERSION = 1;

/**
 * 알 수 없는 형태면 null. 부분적으로 깨진 항목은 버리고 나머지를 살린다.
 *
 * completions·recurrence·reminder는 나중에 생겼다. 없으면 기본값으로 읽는다 —
 * 여기서 버전을 올리면 이미 쓰고 있던 사람의 데이터가 통째로 사라진다.
 */
export function parseGuestData(raw: string | null): GuestData | null {
  if (!raw) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(json)) return null;
  if (json.schemaVersion !== SCHEMA_VERSION) return null;

  const categories = Array.isArray(json.categories)
    ? json.categories.map(parseCategory).filter((c): c is Category => c !== null)
    : [];
  const tasks = Array.isArray(json.tasks)
    ? json.tasks.map(parseTask).filter((t): t is Task => t !== null)
    : [];

  // 사라진 카테고리를 가리키는 할일은 미분류로 돌린다
  reattachOrphans(categories, tasks);

  const completions = pruneCompletions(
    tasks,
    (Array.isArray(json.completions) ? json.completions : [])
      .map(parseCompletion)
      .filter((c): c is TaskCompletion => c !== null),
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    categories,
    tasks,
    completions,
    migrationAsked: json.migrationAsked === true,
  };
}

export function loadGuestData(): GuestData {
  if (typeof window === "undefined") return seedGuestData();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // 프라이빗 모드 등에서 접근이 막힐 수 있다. 메모리 상태로만 동작한다
    return seedGuestData();
  }
  const parsed = parseGuestData(raw);
  if (parsed) return parsed;

  const fresh = seedGuestData();
  saveGuestData(fresh);
  return fresh;
}

export function saveGuestData(data: GuestData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 용량 초과 등. 저장은 실패해도 화면은 계속 동작해야 한다
  }
}

export function clearGuestData(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}
