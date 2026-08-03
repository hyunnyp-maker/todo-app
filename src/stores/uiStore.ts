/**
 * UI 상태 — 서버와 무관한 것만 (06-architecture 2장).
 * 서버에서 온 데이터는 여기 넣지 않는다. 그건 TanStack Query가 유일한 소유자다.
 *
 * selectedDate / visibleMonth는 "사용자가 명시적으로 고른 값"만 담고 저장하지 않는다.
 * 그래야 앱을 열면 항상 오늘이 된다 (03-scenarios P2).
 * 반대로 필터 설정은 새로고침해도 남아야 한다 (요구사항 F5-3).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { monthOf } from "@/domain/date";
import type { ISODate, ISOMonth, ThemeMode } from "@/domain/types";

interface UiState {
  selectedDate: ISODate | null;
  visibleMonth: ISOMonth | null;
  calendarCollapsed: boolean;
  hiddenCategoryIds: string[];
  hideCompleted: boolean;
  overdueOpen: boolean;
  theme: ThemeMode;
  /** 알림이 뜰 때 소리도 낼지. 알림 자체와 별개로 끌 수 있다 */
  notifySound: boolean;
  setNotifySound: (v: boolean) => void;
  setTheme: (mode: ThemeMode) => void;

  selectDate: (date: ISODate) => void;
  /** today를 함께 받는다 — 옮겨간 달 안으로 선택 날짜를 데려가야 하기 때문이다 */
  goToMonth: (month: ISOMonth, today: ISODate) => void;
  goToToday: (today: ISODate) => void;
  setCalendarCollapsed: (v: boolean) => void;
  toggleCategory: (id: string) => void;
  /** 백업 복원이 필터 상태를 통째로 되돌릴 때 쓴다 */
  setHiddenCategoryIds: (ids: string[]) => void;
  setHideCompleted: (v: boolean) => void;
  toggleOverdue: () => void;
}

/**
 * 테마를 문서에 반영한다.
 *
 * 첫 페인트 전에는 layout.tsx의 인라인 스크립트가 같은 일을 한다 —
 * React가 붙기를 기다리면 흰 화면이 한 번 번쩍인다.
 * 여기서는 사용자가 설정에서 바꿨을 때만 호출된다.
 */
export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  document.documentElement.dataset.theme = resolved;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedDate: null,
      visibleMonth: null,
      calendarCollapsed: false,
      hiddenCategoryIds: [],
      // 완료 항목이 사라지면 "오늘 뭐 했지"에 답할 게 없어진다 (P7)
      hideCompleted: false,
      overdueOpen: false,
      theme: "system",
      notifySound: true,

      setNotifySound: (v) => set({ notifySound: v }),

      setTheme: (mode) => {
        set({ theme: mode });
        applyTheme(mode);
      },

      // 날짜를 고르면 보이는 달도 따라간다 (다른 달 칸을 탭한 경우)
      selectDate: (date) =>
        set({ selectedDate: date, visibleMonth: monthOf(date) }),

      // 달을 넘기면 선택 날짜도 그 달로 데려간다.
      //
      // 두고 오면 조회 범위(그 달의 그리드)와 선택 날짜가 어긋난다.
      // 8월 3일을 고른 채 9월로 넘기면 8월 3일 리스트가 9월 범위에 걸친 것만
      // 남아 할일이 소리 없이 사라진다. 화면상 "9월을 보는데 8월 3일 목록"이라는
      // 상태 자체도 설명하기 어렵다.
      //
      // 그 달에 오늘이 있으면 오늘로 — 되돌아왔을 때 오늘에 서 있어야 한다 (P2)
      goToMonth: (month, today) =>
        set({
          visibleMonth: month,
          selectedDate: monthOf(today) === month ? today : `${month}-01`,
        }),

      goToToday: (today) =>
        set({ selectedDate: today, visibleMonth: monthOf(today) }),

      setCalendarCollapsed: (v) => set({ calendarCollapsed: v }),

      toggleCategory: (id) =>
        set((s) => ({
          hiddenCategoryIds: s.hiddenCategoryIds.includes(id)
            ? s.hiddenCategoryIds.filter((x) => x !== id)
            : [...s.hiddenCategoryIds, id],
        })),

      setHiddenCategoryIds: (ids) => set({ hiddenCategoryIds: ids }),

      setHideCompleted: (v) => set({ hideCompleted: v }),
      toggleOverdue: () => set((s) => ({ overdueOpen: !s.overdueOpen })),
    }),
    {
      name: "todo-app:ui:v1",
      // 날짜는 저장하지 않는다 — 저장하면 P2가 깨진다
      partialize: (s) => ({
        hiddenCategoryIds: s.hiddenCategoryIds,
        hideCompleted: s.hideCompleted,
        theme: s.theme,
        notifySound: s.notifySound,
      }),
    },
  ),
);
