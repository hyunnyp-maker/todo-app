import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  covers,
  dayCount,
  dayIndex,
  datesBetween,
  daysLeft,
  diffDays,
  endOfMonth,
  formatMonthTitle,
  GRID_COLS,
  GRID_ROWS,
  monthGridRange,
  monthOf,
  overlapsRange,
  parseISODate,
  toISODate,
  weekdayKo,
} from "./date";

describe("변환", () => {
  it("Date ↔ ISO 왕복에서 날짜가 밀리지 않는다", () => {
    // 시간대 버그가 있으면 여기서 하루씩 밀린다
    for (const iso of ["2026-01-01", "2026-08-03", "2026-12-31"]) {
      expect(toISODate(parseISODate(iso))).toBe(iso);
    }
  });

  it("한 자리 월·일을 0으로 채운다", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("일 계산", () => {
  it("addDays가 달·해 경계를 넘는다", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("diffDays", () => {
    expect(diffDays("2026-08-03", "2026-08-03")).toBe(0);
    expect(diffDays("2026-08-03", "2026-08-14")).toBe(11);
    expect(diffDays("2026-08-14", "2026-08-03")).toBe(-11);
  });

  it("서머타임이 없는 지역이라도 월 경계에서 반올림 오차가 없다", () => {
    expect(diffDays("2026-02-28", "2026-03-01")).toBe(1); // 2026 평년
    expect(diffDays("2028-02-28", "2028-03-01")).toBe(2); // 2028 윤년
  });

  it("dayCount는 하루짜리를 1로 센다", () => {
    expect(dayCount("2026-08-03", "2026-08-03")).toBe(1);
    expect(dayCount("2026-08-10", "2026-08-16")).toBe(7);
  });

  it("dayIndex는 첫날을 1일차로 센다", () => {
    expect(dayIndex("2026-08-10", "2026-08-10")).toBe(1);
    expect(dayIndex("2026-08-10", "2026-08-12")).toBe(3);
  });

  it("daysLeft는 마감 당일에 0, 지나면 음수", () => {
    expect(daysLeft("2026-08-14", "2026-08-03")).toBe(11);
    expect(daysLeft("2026-08-03", "2026-08-03")).toBe(0);
    expect(daysLeft("2026-08-01", "2026-08-03")).toBe(-2);
  });
});

describe("월", () => {
  it("monthOf / endOfMonth", () => {
    expect(monthOf("2026-08-03")).toBe("2026-08");
    expect(endOfMonth("2026-08")).toBe("2026-08-31");
    expect(endOfMonth("2026-02")).toBe("2026-02-28");
    expect(endOfMonth("2028-02")).toBe("2028-02-29"); // 윤년
  });

  it("addMonths가 해를 넘는다", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("formatMonthTitle", () => {
    expect(formatMonthTitle("2026-08")).toBe("2026년 8월");
  });
});

describe("월 그리드", () => {
  it("항상 6행 7열이다 (레이아웃 높이 고정)", () => {
    // 5주면 충분한 달과 6주가 필요한 달 모두 6행이어야 한다
    for (const m of ["2026-02", "2026-08", "2026-05", "2027-01"]) {
      const grid = buildMonthGrid(m);
      expect(grid).toHaveLength(GRID_ROWS);
      for (const row of grid) expect(row).toHaveLength(GRID_COLS);
    }
  });

  it("첫 칸이 일요일이다", () => {
    const grid = buildMonthGrid("2026-08");
    expect(weekdayKo(grid[0][0])).toBe("일");
  });

  it("2026-08은 1일이 토요일이라 첫 행이 7/26에서 시작한다", () => {
    const grid = buildMonthGrid("2026-08");
    expect(grid[0][0]).toBe("2026-07-26");
    expect(grid[0][6]).toBe("2026-08-01");
  });

  it("42칸이 하루도 빠짐없이 연속한다", () => {
    const flat = buildMonthGrid("2026-08").flat();
    expect(flat).toHaveLength(42);
    for (let i = 1; i < flat.length; i++) {
      expect(diffDays(flat[i - 1], flat[i])).toBe(1);
    }
  });

  it("monthGridRange가 그리드 전체를 덮는다", () => {
    const range = monthGridRange("2026-08");
    expect(range.from).toBe("2026-07-26");
    expect(range.to).toBe("2026-09-05");
  });
});

describe("기간 겹침", () => {
  const august = monthGridRange("2026-08"); // 7/26 ~ 9/5

  it("달을 넘는 기간이 양쪽 달 조회에 모두 걸린다", () => {
    // 이게 깨지면 3/28~4/3 할일이 4월 달력에서 사라진다
    const march = monthGridRange("2026-03");
    const april = monthGridRange("2026-04");
    expect(overlapsRange("2026-03-28", "2026-04-03", march)).toBe(true);
    expect(overlapsRange("2026-03-28", "2026-04-03", april)).toBe(true);
  });

  it("범위 밖은 걸리지 않는다", () => {
    expect(overlapsRange("2026-06-01", "2026-06-30", august)).toBe(false);
    expect(overlapsRange("2026-10-01", "2026-10-01", august)).toBe(false);
  });

  it("경계 하루만 겹쳐도 걸린다", () => {
    expect(overlapsRange("2026-07-01", "2026-07-26", august)).toBe(true);
    expect(overlapsRange("2026-09-05", "2026-09-30", august)).toBe(true);
    expect(overlapsRange("2026-07-01", "2026-07-25", august)).toBe(false);
    expect(overlapsRange("2026-09-06", "2026-09-30", august)).toBe(false);
  });

  it("covers는 기간 내부 날짜를 포함한다", () => {
    expect(covers("2026-08-10", "2026-08-16", "2026-08-10")).toBe(true);
    expect(covers("2026-08-10", "2026-08-16", "2026-08-13")).toBe(true);
    expect(covers("2026-08-10", "2026-08-16", "2026-08-16")).toBe(true);
    expect(covers("2026-08-10", "2026-08-16", "2026-08-09")).toBe(false);
  });

  it("datesBetween", () => {
    expect(datesBetween("2026-08-30", "2026-09-02")).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
    expect(datesBetween("2026-08-03", "2026-08-03")).toEqual(["2026-08-03"]);
  });
});
