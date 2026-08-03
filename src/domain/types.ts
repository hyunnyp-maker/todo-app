/**
 * 도메인 타입 — 06-architecture.md 3.2
 *
 * 이 파일을 포함한 domain/ 전체는 React도 Supabase도 모른다.
 * 아무것도 import 하지 않는다.
 */

/** 팔레트 키. DB에는 hex가 아니라 이 키를 저장한다 (05-design 2.2) */
export type PaletteKey =
  | "sage"
  | "rose"
  | "mist"
  | "lavender"
  | "clay"
  | "mustard"
  | "olive"
  | "teal"
  | "plum"
  | "sand"
  | "slate"
  | "coral";

/**
 * once  — 마감형. 기간 전체에 체크 한 번 (done)
 * daily — 지속형. 날짜마다 따로 체크 (completedDates)
 */
export type CheckMode = "once" | "daily";

/** "YYYY-MM-DD" */
export type ISODate = string;

/** "YYYY-MM" */
export type ISOMonth = string;

export interface Category {
  id: string;
  name: string;
  color: PaletteKey;
  sortOrder: number;
}

export interface Task {
  id: string;
  /** null = 미분류. 카테고리 삭제 시 여기로 온다 */
  categoryId: string | null;
  title: string;
  memo?: string;
  startDate: ISODate;
  /** 하루짜리면 startDate와 동일 */
  endDate: ISODate;
  checkMode: CheckMode;
  /** checkMode: "once" 전용 */
  done: boolean;
  /** checkMode: "daily" 전용 */
  completedDates: ISODate[];
  sortOrder: number;
  createdAt: string;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/** 게스트 모드 localStorage 구조 */
export interface GuestData {
  schemaVersion: 1;
  categories: Category[];
  tasks: Task[];
  /** 로그인 시 이관 여부를 한 번만 묻기 위한 플래그 (요구사항 3.3) */
  migrationAsked: boolean;
}

/** 카테고리 삭제 시 소속 할일 처리 (요구사항 4.3) */
export type CategoryDeleteMode = "orphan" | "cascade";
