// @vitest-environment jsdom
/**
 * 달 이동이 선택 날짜를 데려가는지 — Playwright 사용자 테스트에서 잡힌 결함의 회귀 테스트.
 *
 * 선택 날짜를 이전 달에 두고 오면 조회 범위와 어긋나
 * 그 날짜의 할일이 화면에서 소리 없이 사라진다 (docs/qa/19 D-1).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "./uiStore";

const TODAY = "2026-08-03";

describe("goToMonth", () => {
  beforeEach(() => {
    useUiStore.setState({ selectedDate: TODAY, visibleMonth: "2026-08" });
  });

  it("다른 달로 넘기면 선택 날짜도 그 달로 따라간다", () => {
    useUiStore.getState().goToMonth("2026-09", TODAY);

    const { visibleMonth, selectedDate } = useUiStore.getState();
    expect(visibleMonth).toBe("2026-09");
    expect(selectedDate).toBe("2026-09-01");
  });

  it("오늘이 있는 달로 돌아오면 오늘을 다시 고른다", () => {
    useUiStore.getState().goToMonth("2026-09", TODAY);
    useUiStore.getState().goToMonth("2026-08", TODAY);

    expect(useUiStore.getState().selectedDate).toBe(TODAY);
  });

  it("선택 날짜는 언제나 보고 있는 달 안에 있다", () => {
    for (const month of ["2026-09", "2026-12", "2027-01", "2026-08"]) {
      useUiStore.getState().goToMonth(month, TODAY);
      const { visibleMonth, selectedDate } = useUiStore.getState();
      expect(selectedDate?.slice(0, 7)).toBe(visibleMonth);
    }
  });
});
