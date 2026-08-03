import { DEFAULT_CATEGORY_COLORS } from "@/domain/palette";
import type { Category, GuestData } from "@/domain/types";
import { newId } from "../repository";

/**
 * 최초 실행 시 기본 카테고리 3개를 만든다.
 *
 * 샘플 할일은 넣지 않는다 (03-scenarios P12).
 * 서지호(첫 방문자)에게는 카테고리 3개와 빈 상태 문구로 충분하고,
 * 하윤(실사용자)에게 첫날 지워야 할 짐을 남기지 않는다.
 */
export function seedCategories(): Category[] {
  return [
    { id: newId(), name: "직장", color: DEFAULT_CATEGORY_COLORS.work, sortOrder: 0 },
    { id: newId(), name: "개인", color: DEFAULT_CATEGORY_COLORS.personal, sortOrder: 1 },
    { id: newId(), name: "가족", color: DEFAULT_CATEGORY_COLORS.family, sortOrder: 2 },
  ];
}

export function seedGuestData(): GuestData {
  return {
    schemaVersion: 1,
    categories: seedCategories(),
    tasks: [],
    migrationAsked: false,
  };
}
