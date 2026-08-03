/**
 * 게스트 모드 localStorage — 요구사항 4.5 · F6-4
 *
 * 원칙: 저장 데이터가 깨져도 앱은 죽지 않는다.
 * 파싱 실패·스키마 불일치 시 흰 화면 대신 초기 상태로 복구한다.
 */

import { normalizePaletteKey } from "@/domain/palette";
import type { Category, GuestData, Task } from "@/domain/types";
import { seedGuestData } from "./seed";

export const STORAGE_KEY = "todo-app:guest:v1";
const SCHEMA_VERSION = 1;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseCategory(v: unknown): Category | null {
  if (!isRecord(v)) return null;
  const { id, name, color, sortOrder } = v;
  if (typeof id !== "string" || id === "") return null;
  if (typeof name !== "string") return null;
  // 파스텔 시절 키(sage·mist·clay…)는 새 비비드 키로 조용히 갈아끼운다
  const normalized = normalizePaletteKey(color);
  if (!normalized) return null;
  return {
    id,
    name,
    color: normalized,
    sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
  };
}

function parseTask(v: unknown): Task | null {
  if (!isRecord(v)) return null;
  const { id, title, startDate, endDate } = v;
  if (typeof id !== "string" || id === "") return null;
  if (typeof title !== "string" || title === "") return null;
  if (typeof startDate !== "string" || !ISO_DATE.test(startDate)) return null;
  if (typeof endDate !== "string" || !ISO_DATE.test(endDate)) return null;
  // 뒤집힌 기간은 살려서 고친다 — 버린다고 사용자에게 좋을 게 없다
  const [from, to] = startDate <= endDate ? [startDate, endDate] : [endDate, startDate];

  const checkMode = v.checkMode === "daily" ? "daily" : "once";
  const completedDates = Array.isArray(v.completedDates)
    ? v.completedDates.filter(
        (d): d is string => typeof d === "string" && ISO_DATE.test(d),
      )
    : [];

  return {
    id,
    categoryId: typeof v.categoryId === "string" ? v.categoryId : null,
    title,
    memo: typeof v.memo === "string" ? v.memo : undefined,
    startDate: from,
    endDate: to,
    checkMode,
    done: v.done === true,
    completedDates,
    sortOrder: typeof v.sortOrder === "number" ? v.sortOrder : 0,
    createdAt:
      typeof v.createdAt === "string" ? v.createdAt : new Date().toISOString(),
  };
}

/** 알 수 없는 형태면 null. 부분적으로 깨진 항목은 버리고 나머지를 살린다 */
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
  const ids = new Set(categories.map((c) => c.id));
  for (const t of tasks) {
    if (t.categoryId !== null && !ids.has(t.categoryId)) t.categoryId = null;
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    categories,
    tasks,
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
