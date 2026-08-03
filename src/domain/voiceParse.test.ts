import { describe, expect, it } from "vitest";
import { formatTimeKo, parseVoiceTodo } from "./voiceParse";

/** 2026-08-03은 월요일. 모든 상대 날짜가 이 날을 기준으로 계산된다 */
const NOW = new Date(2026, 7, 3);

const parse = (input: string) => parseVoiceTodo(input, NOW);

describe("요구사항의 예시 세 가지", () => {
  it("내일 오후 3시 병원 예약", () => {
    const r = parse("내일 오후 3시 병원 예약");
    expect(r.title).toBe("병원 예약");
    expect(r.startDate).toBe("2026-08-04");
    expect(r.time).toBe("15:00");
    expect(r.recurrence).toBeUndefined();
  });

  it("매주 월요일 오전 10시 팀 회의", () => {
    const r = parse("매주 월요일 오전 10시 팀 회의");
    expect(r.title).toBe("팀 회의");
    expect(r.time).toBe("10:00");
    expect(r.recurrence).toEqual({ type: "weekly", daysOfWeek: [1] });
    // 기준일이 월요일이라 첫 회차가 그날이다
    expect(r.startDate).toBe("2026-08-03");
  });

  it("8월 10일까지 보고서 제출", () => {
    const r = parse("8월 10일까지 보고서 제출");
    expect(r.title).toBe("보고서 제출");
    expect(r.endDate).toBe("2026-08-10");
    // 까지는 마감이다. 시작일을 멋대로 정하지 않는다
    expect(r.startDate).toBeUndefined();
  });
});

describe("상대 날짜", () => {
  it("오늘 · 내일 · 모레", () => {
    expect(parse("오늘 장보기").startDate).toBe("2026-08-03");
    expect(parse("내일 장보기").startDate).toBe("2026-08-04");
    expect(parse("모레 장보기").startDate).toBe("2026-08-05");
  });

  it("이번 주 금요일", () => {
    const r = parse("이번 주 금요일 회식");
    expect(r.startDate).toBe("2026-08-07");
    expect(r.title).toBe("회식");
  });

  it("다음 주 월요일", () => {
    expect(parse("다음 주 월요일 출장").startDate).toBe("2026-08-10");
  });

  it("다음 달 10일", () => {
    expect(parse("다음 달 10일 정기 점검").startDate).toBe("2026-09-10");
  });

  it("요일만 말하면 다가오는 그 요일", () => {
    // 기준일이 월요일이므로 이번 주 금요일
    expect(parse("금요일 회식").startDate).toBe("2026-08-07");
  });
});

describe("절대 날짜", () => {
  it("8월 10일", () => {
    expect(parse("8월 10일 회의").startDate).toBe("2026-08-10");
  });

  it("2026년 8월 10일", () => {
    expect(parse("2026년 8월 10일 회의").startDate).toBe("2026-08-10");
  });

  it("연도가 없고 올해분이 지났으면 다음 해로 넘긴다", () => {
    const r = parse("1월 5일 신년회");
    expect(r.startDate).toBe("2027-01-05");
    expect(r.warnings.join(" ")).toContain("2027년");
    // 해를 넘긴 해석은 확신할 수 없다
    expect(r.confidence.date).toBe(false);
  });

  it("없는 날짜는 확정하지 않고 경고한다", () => {
    const r = parse("2월 30일 점검");
    expect(r.warnings.join(" ")).toContain("없는 날짜");
    expect(r.confidence.date).toBe(false);
  });

  it("8월 10일부터 8월 15일까지", () => {
    const r = parse("8월 10일부터 8월 15일까지 휴가");
    expect(r.startDate).toBe("2026-08-10");
    expect(r.endDate).toBe("2026-08-15");
    expect(r.title).toBe("휴가");
  });

  it("범위가 뒤집혀 있으면 바로잡고 알린다", () => {
    const r = parse("8월 15일부터 8월 10일까지 휴가");
    expect(r.startDate).toBe("2026-08-10");
    expect(r.endDate).toBe("2026-08-15");
    expect(r.warnings.join(" ")).toContain("바꿨습니다");
  });
});

describe("시간", () => {
  it("오전은 그대로, 오후는 12를 더한다", () => {
    expect(parse("오전 9시 조회").time).toBe("09:00");
    expect(parse("오후 3시 미팅").time).toBe("15:00");
  });

  it("오전 12시는 자정, 오후 12시는 정오", () => {
    expect(parse("오전 12시 마감").time).toBe("00:00");
    expect(parse("오후 12시 점심").time).toBe("12:00");
  });

  it("24시간 표기", () => {
    const r = parse("14시 회의");
    expect(r.time).toBe("14:00");
    expect(r.confidence.time).toBe(true);
  });

  it("분 단위", () => {
    expect(parse("오전 9시 30분 조회").time).toBe("09:30");
  });

  it("오후 3시 반", () => {
    expect(parse("오후 3시 반 미팅").time).toBe("15:30");
  });

  it("오전·오후를 말하지 않으면 들은 대로 두고 경고한다", () => {
    const r = parse("3시 미팅");
    expect(r.time).toBe("03:00");
    expect(r.confidence.time).toBe(false);
    expect(r.warnings.join(" ")).toContain("오전·오후");
  });
});

describe("반복", () => {
  it("매일", () => {
    const r = parse("매일 오전 9시 약 먹기");
    expect(r.recurrence).toEqual({ type: "daily" });
    expect(r.title).toBe("약 먹기");
    expect(r.time).toBe("09:00");
    expect(r.startDate).toBe("2026-08-03");
  });

  it("평일마다", () => {
    const r = parse("평일마다 오전 8시 출근 준비");
    expect(r.recurrence).toEqual({ type: "weekdays" });
    expect(r.title).toBe("출근 준비");
  });

  it("매주 특정 요일", () => {
    const r = parse("매주 월요일 회의");
    expect(r.recurrence).toEqual({ type: "weekly", daysOfWeek: [1] });
    expect(r.title).toBe("회의");
  });

  it("복수 요일", () => {
    const r = parse("매주 화요일과 목요일 운동");
    expect(r.recurrence).toEqual({ type: "weekly", daysOfWeek: [2, 4] });
    expect(r.title).toBe("운동");
  });

  it("붙여 말한 요일", () => {
    expect(parse("매주 월수금 헬스").recurrence).toEqual({
      type: "weekly",
      daysOfWeek: [1, 3, 5],
    });
  });

  it("요일 목록의 '요일'을 일요일로 세지 않는다", () => {
    // 화요일·목요일에서 '요일'의 일(日)을 0으로 읽으면 일요일이 끼어든다
    expect(parse("매주 화요일과 목요일 운동").recurrence).toEqual({
      type: "weekly",
      daysOfWeek: [2, 4],
    });
  });

  it("제목의 첫 글자가 요일 글자여도 집어가지 않는다", () => {
    const r = parse("매주 목요일 목표 점검");
    expect(r.recurrence).toEqual({ type: "weekly", daysOfWeek: [4] });
    expect(r.title).toBe("목표 점검");
  });

  it("매월 특정 날짜", () => {
    const r = parse("매월 25일 카드값 확인");
    expect(r.recurrence).toEqual({ type: "monthly", dayOfMonth: 25 });
    expect(r.title).toBe("카드값 확인");
    expect(r.startDate).toBe("2026-08-25");
  });

  it("반복 시작일은 다음 회차다", () => {
    // 기준일이 월요일이므로 다음 수요일
    expect(parse("매주 수요일 회의").startDate).toBe("2026-08-05");
  });

  it("매주라고만 하면 확정하지 않고 경고한다", () => {
    const r = parse("매주 회의");
    expect(r.recurrence).toBeUndefined();
    expect(r.confidence.recurrence).toBe(false);
    expect(r.warnings.join(" ")).toContain("몇 요일");
  });
});

describe("제목", () => {
  it("날짜·시간·반복 표현을 모두 걷어낸다", () => {
    const r = parse("매주 화요일과 목요일 오후 7시 30분 헬스장 가기");
    expect(r.title).toBe("헬스장 가기");
  });

  it("홀로 남은 조사를 지운다", () => {
    expect(parse("내일에 병원").title).toBe("병원");
  });

  it("조사와 같은 글자로 시작하는 단어는 건드리지 않는다", () => {
    expect(parse("내일 의사 만나기").title).toBe("의사 만나기");
  });

  it("명령형 꼬리를 지운다", () => {
    expect(parse("내일 장보기 추가해줘").title).toBe("장보기");
  });

  it("어미가 없는 '추가'는 제목의 일부로 둔다", () => {
    expect(parse("내일 예산 추가").title).toBe("예산 추가");
  });

  it("제목이 없으면 신뢰도를 내리고 경고한다", () => {
    const r = parse("내일 오후 3시");
    expect(r.title).toBe("");
    expect(r.confidence.title).toBe(false);
    expect(r.warnings.join(" ")).toContain("제목");
  });
});

describe("모호한 입력", () => {
  it("날짜도 반복도 없으면 경고한다", () => {
    const r = parse("장보기");
    expect(r.startDate).toBeUndefined();
    expect(r.confidence.date).toBe(false);
    expect(r.warnings.join(" ")).toContain("날짜");
  });

  it("원문은 그대로 남긴다", () => {
    expect(parse("  내일 병원  ").rawText).toBe("내일 병원");
  });

  it("빈 입력도 던지지 않는다", () => {
    const r = parse("");
    expect(r.title).toBe("");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("formatTimeKo", () => {
  it("24시간 값을 한국어로 읽는다", () => {
    expect(formatTimeKo("15:00")).toBe("오후 3시");
    expect(formatTimeKo("09:30")).toBe("오전 9시 30분");
    expect(formatTimeKo("00:00")).toBe("오전 12시");
    expect(formatTimeKo("12:00")).toBe("오후 12시");
  });
});
