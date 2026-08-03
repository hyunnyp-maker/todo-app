/**
 * 백업 파일 — JSON 내보내기 / 가져오기.
 *
 * 이 파일에는 비밀번호도, 인증 토큰도, Supabase 세션도 담지 않는다.
 * 사용자가 만든 것(카테고리·할일·완료 기록·화면 설정)만 담는다.
 *
 * 가져오기는 병합이 아니라 전체 교체다.
 * 병합은 "같은 할일인지"를 판단해야 하는데, 그 판단이 틀리면 조용히 중복이 생긴다.
 * 이번 버전은 교체만 하고, 대신 덮어쓰기 전에 반드시 확인을 받는다.
 */

import {
  parseCategory,
  parseCompletion,
  parseTask,
  pruneCompletions,
  reattachOrphans,
  isRecord,
} from "./parse";
import type {
  Category,
  ISODate,
  Task,
  TaskCompletion,
  ThemeMode,
} from "./types";

export const BACKUP_VERSION = 1;

export interface BackupSettings {
  theme: ThemeMode;
  hideCompleted: boolean;
  hiddenCategoryIds: string[];
  notifySound: boolean;
}

export interface BackupPayload {
  categories: Category[];
  /** 일반 · 기간형 · 반복 일정이 모두 여기 들어 있다 (반복은 recurrence 필드로 구분) */
  tasks: Task[];
  /** 반복 일정의 날짜별 완료 기록 */
  completions: TaskCompletion[];
  settings: BackupSettings;
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  data: BackupPayload;
}

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  theme: "system",
  hideCompleted: false,
  hiddenCategoryIds: [],
  notifySound: true,
};

export function buildBackupFile(
  payload: BackupPayload,
  exportedAt: string,
): BackupFile {
  return { version: BACKUP_VERSION, exportedAt, data: payload };
}

/** "myquence-backup-2026-08-03.json" */
export function backupFileName(today: ISODate): string {
  return `myquence-backup-${today}.json`;
}

export type ParseBackupResult =
  | { ok: true; file: BackupFile }
  | { ok: false; reason: string };

function parseTheme(v: unknown): ThemeMode {
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function parseSettings(v: unknown): BackupSettings {
  if (!isRecord(v)) return { ...DEFAULT_BACKUP_SETTINGS };
  return {
    theme: parseTheme(v.theme),
    hideCompleted: v.hideCompleted === true,
    hiddenCategoryIds: Array.isArray(v.hiddenCategoryIds)
      ? v.hiddenCategoryIds.filter((x): x is string => typeof x === "string")
      : [],
    // 소리 설정이 없던 시절의 백업은 기본값(켜짐)으로 읽는다
    notifySound: v.notifySound === undefined ? true : v.notifySound === true,
  };
}

/**
 * 파일 하나를 검증한다. 여기서 통과하지 못하면 복원을 시작조차 하지 않는다.
 *
 * 구조가 아니라 "버전"을 먼저 본다. 모르는 버전의 파일을 관대하게 읽으면
 * 알아보지 못한 필드가 통째로 사라진 채 덮어쓰기가 끝난다.
 */
export function parseBackupFile(text: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: "JSON 형식이 아닙니다." };
  }
  if (!isRecord(json)) {
    return { ok: false, reason: "백업 파일 구조가 아닙니다." };
  }
  if (typeof json.version !== "number") {
    return { ok: false, reason: "version 정보가 없습니다." };
  }
  if (json.version !== BACKUP_VERSION) {
    return {
      ok: false,
      reason: `지원하지 않는 버전입니다 (파일 v${json.version} · 앱 v${BACKUP_VERSION}).`,
    };
  }
  if (!isRecord(json.data)) {
    return { ok: false, reason: "data가 없습니다." };
  }

  const raw = json.data;
  if (!Array.isArray(raw.categories) || !Array.isArray(raw.tasks)) {
    return { ok: false, reason: "categories 또는 tasks가 배열이 아닙니다." };
  }

  const categories = raw.categories
    .map(parseCategory)
    .filter((c): c is Category => c !== null);
  const tasks = raw.tasks.map(parseTask).filter((t): t is Task => t !== null);
  reattachOrphans(categories, tasks);

  const completions = pruneCompletions(
    tasks,
    (Array.isArray(raw.completions) ? raw.completions : [])
      .map(parseCompletion)
      .filter((c): c is TaskCompletion => c !== null),
  );

  return {
    ok: true,
    file: {
      version: BACKUP_VERSION,
      exportedAt:
        typeof json.exportedAt === "string" ? json.exportedAt : "",
      data: {
        categories,
        tasks,
        completions,
        settings: parseSettings(raw.settings),
      },
    },
  };
}
