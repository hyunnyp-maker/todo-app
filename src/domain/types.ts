/**
 * 도메인 타입 — 06-architecture.md 3.2
 *
 * 이 파일을 포함한 domain/ 전체는 React도 Supabase도 모른다.
 * 아무것도 import 하지 않는다.
 */

/** 팔레트 키. DB에는 hex가 아니라 이 키를 저장한다 (05-design 2.2) */
export type PaletteKey =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "pink"
  | "purple"
  | "brown"
  | "ink"
  // 카테고리가 9개를 넘으면 색이 겹친다. 색상환의 빈 구간을 채워 18색으로 늘렸다
  | "lime"
  | "mint"
  | "sky"
  | "navy"
  | "indigo"
  | "wine"
  | "peach"
  | "khaki"
  | "gray";

/** 화면 테마. system은 기기 설정을 따라간다 */
export type ThemeMode = "light" | "dark" | "system";

/**
 * once  — 마감형. 기간 전체에 체크 한 번 (done)
 * daily — 지속형. 날짜마다 따로 체크 (completedDates)
 *
 * 반복 일정(recurrence)은 이 둘과 별개의 축이다.
 * 반복이 걸린 할일은 checkMode를 보지 않고 TaskCompletion 기록으로 판정한다.
 */
export type CheckMode = "once" | "daily";

/**
 * 반복 규칙 — 규칙만 저장하고 날짜별 복제본은 만들지 않는다.
 * 노출 여부는 조회 시점에 계산한다 (domain/recurrence.ts).
 *
 * 반복의 시작일은 Task.startDate다. 규칙 안에는 종료일만 둔다.
 * endDate가 없으면 종료 없음.
 */
export type RecurrenceRule =
  | { type: "daily"; endDate?: ISODate }
  | { type: "weekdays"; endDate?: ISODate }
  /** daysOfWeek: 0=일 … 6=토 */
  | { type: "weekly"; daysOfWeek: number[]; endDate?: ISODate }
  | { type: "monthly"; dayOfMonth: number; endDate?: ISODate };

export type RecurrenceType = RecurrenceRule["type"];

/**
 * 반복 일정의 "그 날짜만" 완료 기록.
 * 할일 본체와 분리해 두어야 규칙을 바꿔도 체크 이력이 남는다.
 */
export interface TaskCompletion {
  taskId: string;
  date: ISODate;
}

/** 알림 시점. 기준 시각(Task.reminderTime)에서 얼마나 앞당길지 */
export type ReminderOffset = "none" | "at" | "10m" | "1h" | "1d";

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
  /**
   * null = 반복 없음.
   * 반복이 있으면 startDate가 반복 시작일, endDate는 규칙의 종료일(없으면 NO_END_DATE)을 따라간다.
   * endDate를 함께 맞춰 두어야 기존 범위 조회(overlapsRange / lte·gte)가 그대로 통한다.
   */
  recurrence: RecurrenceRule | null;
  reminder: ReminderOffset;
  /** 알림 기준 시각 "HH:MM" */
  reminderTime: string;
  sortOrder: number;
  createdAt: string;
}

export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/**
 * 게스트 모드 localStorage 구조.
 *
 * schemaVersion은 1을 유지한다. 올리면 이미 저장된 데이터를 읽지 못해 통째로 날아간다.
 * 새로 생긴 필드는 "없으면 기본값"으로 관대하게 읽는다.
 */
export interface GuestData {
  schemaVersion: 1;
  categories: Category[];
  tasks: Task[];
  /** 반복 일정의 날짜별 완료 기록 */
  completions: TaskCompletion[];
  /** 로그인 시 이관 여부를 한 번만 묻기 위한 플래그 (요구사항 3.3) */
  migrationAsked: boolean;
}

/** 카테고리 삭제 시 소속 할일 처리 (요구사항 4.3) */
export type CategoryDeleteMode = "orphan" | "cascade";
