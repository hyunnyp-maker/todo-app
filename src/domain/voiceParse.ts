/**
 * 음성/자연어 일정 파싱 — 규칙 기반.
 *
 * 외부 AI API도, NLP 라이브러리도 쓰지 않는다.
 * 이유는 셋이다. 말한 내용이 서버로 나가지 않고, 응답을 기다리지 않으며, 오프라인에서도 돈다.
 * 대신 정확도는 규칙이 덮는 범위까지다 — 그래서 결과를 바로 저장하지 않고 반드시 확인을 거친다.
 *
 * 이 파일은 domain/의 다른 파일과 같은 규칙을 따른다. React도 브라우저도 모른다.
 * now를 인자로 받는 이유도 같다 — 안에서 Date.now()를 부르면 테스트할 수 없다.
 *
 * 처리 순서가 중요하다.
 *   반복 → 날짜 → 시간 → 제목
 * "매주 월요일"의 월요일을 날짜 파서가 먼저 집어가면 반복이 사라진다.
 * 그래서 앞 단계가 소비한 구간은 NUL로 덮어 뒤 단계가 다시 보지 못하게 한다.
 * 지우지 않고 덮는 이유는 인덱스를 유지하기 위해서다 — 지우면 뒤의 매치 위치가 전부 밀린다.
 */

import { addDays, lastDayOfMonth, parseISODate, todayISO, weekdayIndex } from "./date";
import { ruleDatesInRange } from "./recurrence";
import type { ISODate, RecurrenceRule } from "./types";

export interface VoiceConfidence {
  title: boolean;
  date: boolean;
  time: boolean;
  recurrence: boolean;
}

export interface ParsedVoiceTodo {
  /** 인식된 원문. 화면에 그대로 보여 주고 잘못 들었는지 사용자가 판단한다 */
  rawText: string;
  title: string;
  startDate?: ISODate;
  endDate?: ISODate;
  /** "HH:MM" */
  time?: string;
  recurrence?: RecurrenceRule;
  confidence: VoiceConfidence;
  warnings: string[];
}

/** 소비된 구간을 덮는 문자. 사람이 말한 문장에 들어올 일이 없다 */
const CUT = String.fromCharCode(0);

const WEEKDAY_CHARS = "일월화수목금토";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 구간을 NUL로 덮는다. 길이가 그대로라 이후 매치 인덱스가 어긋나지 않는다 */
function cut(text: string, start: number, end: number): string {
  return text.slice(0, start) + CUT.repeat(end - start) + text.slice(end);
}

function isoOf(year: number, month: number, day: number): ISODate {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 그 해 그 달에 실제로 있는 날짜인가 */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= lastDayOfMonth(isoOf(year, month, 1));
}

/** 그 주의 월요일. 한국어의 "이번 주"는 월~일이다 */
function mondayOf(iso: ISODate): ISODate {
  const w = weekdayIndex(iso); // 0=일
  return addDays(iso, -(w === 0 ? 6 : w - 1));
}

/** 오늘 포함, 앞으로 가장 가까운 그 요일 */
function nextWeekday(today: ISODate, target: number): ISODate {
  return addDays(today, (target - weekdayIndex(today) + 7) % 7);
}

// ── 반복 ──────────────────────────────────────

const WEEKDAY_LIST_SRC =
  `[${WEEKDAY_CHARS}]요일(?:\\s*(?:,|·|과|와|및|그리고|하고|랑|이랑)?\\s*[${WEEKDAY_CHARS}]요일)*`;

/**
 * 매주 뒤의 요일 목록. 두 형태를 받는다.
 *
 *   형태 1  "월요일" · "화요일과 목요일"   — 요일을 명시
 *   형태 2  "월수금"                       — 붙여 쓴 두 글자 이상
 *
 * 형태 2에서 한 글자를 허용하면 "매주 목요일 목표 정리"의 '목'을 집어간다.
 * 두 글자 이상이고 뒤에 다른 한글이 붙지 않을 것을 요구해 그 사고를 막는다.
 */
const WEEKLY_RE = new RegExp(
  `매\\s*주\\s*(?:(${WEEKDAY_LIST_SRC})|([${WEEKDAY_CHARS}]{2,3})(?=\\s|$|[,.]|에|마다))`,
);
const WEEKLY_BARE_RE = /매\s*주/;
const DAILY_RE = /매\s*일(?:마다)?|날마다/;
const WEEKDAYS_RE = /평일(?:마다|에는|에)?|주중(?:마다|에)?/;
const MONTHLY_RE = /매\s*(?:월|달)\s*(\d{1,2})\s*일/;
const WEEKDAY_IN_LIST_RE = new RegExp(`([${WEEKDAY_CHARS}])요일`, "g");

interface RecurrenceHit {
  start: number;
  end: number;
  rule: RecurrenceRule | null;
  warning?: string;
}

function matchRecurrence(text: string): RecurrenceHit | null {
  const span = (m: RegExpExecArray) => ({
    start: m.index,
    end: m.index + m[0].length,
  });

  const monthly = MONTHLY_RE.exec(text);
  if (monthly) {
    const day = Number(monthly[1]);
    if (day >= 1 && day <= 31) {
      return { ...span(monthly), rule: { type: "monthly", dayOfMonth: day } };
    }
    return {
      ...span(monthly),
      rule: null,
      warning: `매월 ${day}일은 없는 날짜입니다. 반복을 직접 골라 주세요.`,
    };
  }

  const weekly = WEEKLY_RE.exec(text);
  if (weekly) {
    // 형태 1은 "요일" 앞 글자만 읽는다. 통째로 훑으면 '요일'의 일(日)을 일요일로 센다
    const days = weekly[1]
      ? readListed(weekly[1])
      : readCompact(weekly[2] ?? "");
    if (days.length > 0) {
      return { ...span(weekly), rule: { type: "weekly", daysOfWeek: days } };
    }
  }

  const weekdays = WEEKDAYS_RE.exec(text);
  if (weekdays) return { ...span(weekdays), rule: { type: "weekdays" } };

  const daily = DAILY_RE.exec(text);
  if (daily) return { ...span(daily), rule: { type: "daily" } };

  const bare = WEEKLY_BARE_RE.exec(text);
  if (bare) {
    return {
      ...span(bare),
      rule: null,
      warning: "매주 몇 요일인지 알아듣지 못했습니다. 직접 골라 주세요.",
    };
  }

  return null;
}

function readListed(chunk: string): number[] {
  const set = new Set<number>();
  WEEKDAY_IN_LIST_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WEEKDAY_IN_LIST_RE.exec(chunk)) !== null) {
    set.add(WEEKDAY_CHARS.indexOf(m[1]));
  }
  return [...set].sort((a, b) => a - b);
}

function readCompact(chunk: string): number[] {
  const set = new Set<number>();
  for (const ch of chunk) {
    const i = WEEKDAY_CHARS.indexOf(ch);
    if (i >= 0) set.add(i);
  }
  return [...set].sort((a, b) => a - b);
}

// ── 날짜 ──────────────────────────────────────

interface DateHit {
  start: number;
  end: number;
  date: ISODate;
  /** 뒤에 붙은 조사 */
  particle: "from" | "to" | null;
  warning?: string;
  /** 해석이 갈릴 수 있는 날짜인가 */
  fuzzy: boolean;
}

const YEAR_DATE_RE = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
const MONTH_DATE_RE = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
const WEEK_WEEKDAY_RE = new RegExp(
  `(다음|담|이번|저번|지난)\\s*주\\s*([${WEEKDAY_CHARS}])요일`,
  "g",
);
const MONTH_DAY_RE = /(다음|담|이번)\s*(?:달|월)\s*(\d{1,2})\s*일/g;
const RELATIVE_RE = /내일모레|모레|글피|오늘|내일/g;
const BARE_WEEKDAY_RE = new RegExp(`([${WEEKDAY_CHARS}])요일`, "g");
const AFTER_DAYS_RE = /(\d{1,3})\s*일\s*(?:후|뒤)/g;

const PARTICLE_RE = /^\s*(부터|부턴|까지는|까지|까진)/;

function readParticle(
  text: string,
  at: number,
): { particle: "from" | "to" | null; end: number } {
  const m = PARTICLE_RE.exec(text.slice(at));
  if (!m) return { particle: null, end: at };
  const particle = m[1].startsWith("까지") || m[1] === "까진" ? "to" : "from";
  return { particle, end: at + m[0].length };
}

/**
 * 연도를 말하지 않은 날짜.
 * 올해로 읽어 이미 지났으면 내년으로 넘긴다 — "8월 10일"이 작년일 리는 없다.
 */
function resolveYearless(
  month: number,
  day: number,
  today: ISODate,
): { date: ISODate; warning?: string } | null {
  const thisYear = Number(today.slice(0, 4));
  for (const year of [thisYear, thisYear + 1]) {
    if (!isRealDate(year, month, day)) continue;
    const iso = isoOf(year, month, day);
    if (iso < today) continue;
    return year === thisYear
      ? { date: iso }
      : {
          date: iso,
          warning: `연도를 말하지 않아 ${year}년 ${month}월 ${day}일로 보았습니다.`,
        };
  }
  return null;
}

type DateBuild = Omit<DateHit, "start" | "end" | "particle">;

function collectDates(text: string, today: ISODate): DateHit[] {
  const hits: DateHit[] = [];

  const scan = (re: RegExp, build: (m: RegExpExecArray) => DateBuild | null) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // 앞 단계가 이미 가져간 구간이다
      if (m[0].includes(CUT)) continue;
      const built = build(m);
      if (!built) continue;
      const { particle, end } = readParticle(text, m.index + m[0].length);
      hits.push({ ...built, start: m.index, end, particle });
    }
  };

  scan(YEAR_DATE_RE, (m) => {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (!isRealDate(y, mo, d)) {
      return { date: today, fuzzy: true, warning: `${y}년 ${mo}월 ${d}일은 없는 날짜입니다.` };
    }
    return { date: isoOf(y, mo, d), fuzzy: false };
  });

  scan(MONTH_DATE_RE, (m) => {
    const [mo, d] = [Number(m[1]), Number(m[2])];
    const resolved = resolveYearless(mo, d, today);
    if (!resolved) {
      return { date: today, fuzzy: true, warning: `${mo}월 ${d}일은 없는 날짜입니다.` };
    }
    return {
      date: resolved.date,
      fuzzy: resolved.warning !== undefined,
      warning: resolved.warning,
    };
  });

  scan(WEEK_WEEKDAY_RE, (m) => {
    const target = WEEKDAY_CHARS.indexOf(m[2]);
    if (target < 0) return null;
    const offset = m[1] === "다음" || m[1] === "담" ? 7 : m[1] === "이번" ? 0 : -7;
    const date = addDays(mondayOf(today), offset + ((target + 6) % 7));
    if (date < today) {
      return { date, fuzzy: true, warning: `${m[0]}은(는) 이미 지난 날짜입니다.` };
    }
    return { date, fuzzy: false };
  });

  scan(MONTH_DAY_RE, (m) => {
    const day = Number(m[2]);
    if (day < 1 || day > 31) return null;
    const base = parseISODate(today);
    const raw = base.getMonth() + 1 + (m[1] === "이번" ? 0 : 1);
    const year = raw > 12 ? base.getFullYear() + 1 : base.getFullYear();
    const month = raw > 12 ? raw - 12 : raw;
    const last = lastDayOfMonth(isoOf(year, month, 1));
    if (day > last) {
      return {
        date: isoOf(year, month, last),
        fuzzy: true,
        warning: `${month}월에는 ${day}일이 없어 ${last}일로 두었습니다.`,
      };
    }
    const date = isoOf(year, month, day);
    if (date < today) {
      return { date, fuzzy: true, warning: `${m[0]}은(는) 이미 지난 날짜입니다.` };
    }
    return { date, fuzzy: false };
  });

  scan(RELATIVE_RE, (m) => {
    const days =
      m[0] === "오늘" ? 0 : m[0] === "내일" ? 1 : m[0] === "글피" ? 3 : 2;
    return { date: addDays(today, days), fuzzy: false };
  });

  scan(AFTER_DAYS_RE, (m) => ({ date: addDays(today, Number(m[1])), fuzzy: false }));

  scan(BARE_WEEKDAY_RE, (m) => {
    const target = WEEKDAY_CHARS.indexOf(m[1]);
    if (target < 0) return null;
    return { date: nextWeekday(today, target), fuzzy: false };
  });

  return dropOverlaps(hits);
}

/** 겹치는 매치는 먼저 등록된(= 더 구체적인) 쪽을 남긴다 */
function dropOverlaps(hits: DateHit[]): DateHit[] {
  const kept: DateHit[] = [];
  for (const hit of hits) {
    if (kept.some((k) => hit.start < k.end && k.start < hit.end)) continue;
    kept.push(hit);
  }
  return kept.sort((a, b) => a.start - b.start);
}

interface DateResult {
  text: string;
  startDate?: ISODate;
  endDate?: ISODate;
  fuzzy: boolean;
  found: boolean;
  warnings: string[];
}

function parseDates(text: string, today: ISODate): DateResult {
  const hits = collectDates(text, today);
  const warnings: string[] = [];

  let next = text;
  for (const hit of hits) next = cut(next, hit.start, hit.end);

  if (hits.length === 0) return { text: next, fuzzy: false, found: false, warnings };

  for (const hit of hits) if (hit.warning) warnings.push(hit.warning);

  const used = hits.slice(0, 2);
  if (hits.length > 2) warnings.push("날짜 표현이 여러 개라 앞의 둘만 사용했습니다.");

  const fuzzy = used.some((h) => h.fuzzy);

  // "8월 10일부터 8월 15일까지"
  if (used.length === 2 && used[1].particle === "to") {
    let [a, b] = [used[0].date, used[1].date];
    if (a > b) {
      [a, b] = [b, a];
      warnings.push("시작일이 종료일보다 늦어 서로 바꿨습니다.");
    }
    return { text: next, startDate: a, endDate: b, fuzzy, found: true, warnings };
  }

  if (used.length === 2) {
    warnings.push("날짜 표현이 여러 개라 앞의 것만 사용했습니다.");
  }

  const first = used[0];
  // "8월 10일까지"는 마감이다. 시작일은 확인 화면에서 채운다
  if (first.particle === "to") {
    return { text: next, endDate: first.date, fuzzy, found: true, warnings };
  }
  return { text: next, startDate: first.date, fuzzy, found: true, warnings };
}

// ── 시간 ──────────────────────────────────────

const MERIDIEM_AM = ["오전", "아침", "새벽"];
const MERIDIEM_PM = ["오후", "저녁", "밤", "낮", "점심"];

const TIME_RE = new RegExp(
  `(${[...MERIDIEM_AM, ...MERIDIEM_PM].join("|")})?\\s*(\\d{1,2})\\s*시` +
    `(?:\\s*(반|\\d{1,2})\\s*분?)?`,
);

interface TimeResult {
  text: string;
  time?: string;
  fuzzy: boolean;
  warnings: string[];
}

function parseTime(text: string): TimeResult {
  const m = TIME_RE.exec(text);
  if (!m || m[0].includes(CUT)) return { text, fuzzy: false, warnings: [] };

  const meridiem = m[1];
  let hour = Number(m[2]);
  const minute = m[3] === "반" ? 30 : m[3] ? Number(m[3]) : 0;

  if (hour > 23 || minute > 59) {
    return {
      text: cut(text, m.index, m.index + m[0].length),
      fuzzy: true,
      warnings: [`${m[0].trim()}은(는) 시간으로 읽을 수 없습니다.`],
    };
  }

  const warnings: string[] = [];
  let fuzzy = false;

  if (meridiem && MERIDIEM_AM.includes(meridiem)) {
    if (hour === 12) hour = 0;
  } else if (meridiem) {
    if (hour < 12) hour += 12;
  } else if (hour >= 1 && hour <= 11) {
    // "3시"는 오전일 수도 오후일 수도 있다. 마음대로 정하지 않고 들은 대로 두되 알린다
    fuzzy = true;
    warnings.push(`오전·오후를 말하지 않아 ${pad2(hour)}:${pad2(minute)}로 두었습니다.`);
  }

  return {
    text: cut(text, m.index, m.index + m[0].length),
    time: `${pad2(hour)}:${pad2(minute)}`,
    fuzzy,
    warnings,
  };
}

// ── 제목 ──────────────────────────────────────

/**
 * 날짜·시간·반복을 걷어내면 조사가 홀로 남는다. "내일에 병원" → "에 병원".
 * 단어 경계를 요구하는 이유는 '의사'의 '의', '에너지'의 '에'를 지우지 않기 위해서다.
 */
const LEADING_PARTICLE = /^(?:에는|에서|에|의|부터|까지|마다|쯤|경|께|즘)(?=\s|$)\s*/;
const TRAILING_PARTICLE = /\s(?:에는|에|부터|까지|마다|쯤|경|께|즘)$/;

/** "장보기 추가해줘" 같은 명령형 꼬리. 어미까지 붙은 것만 지운다 — '예산 추가'는 제목이다 */
const COMMAND_TAIL =
  /\s*(?:일정\s*)?(?:추가|등록|저장)\s*(?:하기|해줘|해 줘|해주세요|해줄래|해라|해)\s*$/;
const POLITE_TAIL = /\s*(?:해줘|해 줘|해주세요|알려줘|잡아줘|넣어줘|만들어줘)\s*$/;

function cleanTitle(text: string): string {
  let out = text.split(CUT).join(" ");
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/^[,.·・\-–—]+|[,.·・\-–—]+$/g, "").trim();

  for (let i = 0; i < 3; i++) {
    const before = out;
    out = out.replace(LEADING_PARTICLE, "").replace(TRAILING_PARTICLE, "").trim();
    if (out === before) break;
  }

  // 꼬리를 떼서 아무것도 안 남으면 원래 것을 둔다 — "추가해줘"만 말했을 때
  for (const re of [COMMAND_TAIL, POLITE_TAIL]) {
    const stripped = out.replace(re, "").trim();
    if (stripped !== "") out = stripped;
  }

  return out.replace(/\s+/g, " ").trim();
}

// ── 진입점 ────────────────────────────────────

/**
 * 자연어 한 줄을 일정 초안으로 바꾼다.
 *
 * 확정하지 않는다. 결과는 확인 화면을 거쳐야 저장된다.
 * 애매한 것은 임의로 정하지 말고 warnings에 남겨 사용자가 고치게 한다.
 */
export function parseVoiceTodo(input: string, now: Date): ParsedVoiceTodo {
  const rawText = input.trim();
  const today = todayISO(now);
  const warnings: string[] = [];

  let working = rawText;

  const rec = matchRecurrence(working);
  if (rec) {
    working = cut(working, rec.start, rec.end);
    if (rec.warning) warnings.push(rec.warning);
  }
  const rule = rec?.rule ?? undefined;

  const dates = parseDates(working, today);
  working = dates.text;
  warnings.push(...dates.warnings);

  const time = parseTime(working);
  working = time.text;
  warnings.push(...time.warnings);

  const title = cleanTitle(working);
  if (title === "") warnings.push("제목을 알아듣지 못했습니다. 직접 입력해 주세요.");

  // 반복만 말하고 날짜를 말하지 않았으면 첫 회차가 시작일이다.
  // "매주 월요일 회의"는 다음 월요일부터 시작한다
  let startDate = dates.startDate;
  if (!startDate && rule) startDate = firstOccurrence(rule, today);

  if (!dates.found && !rule) {
    warnings.push("날짜를 알아듣지 못했습니다. 직접 골라 주세요.");
  }

  return {
    rawText,
    title,
    ...(startDate ? { startDate } : {}),
    ...(dates.endDate ? { endDate: dates.endDate } : {}),
    ...(time.time ? { time: time.time } : {}),
    ...(rule ? { recurrence: rule } : {}),
    confidence: {
      title: title !== "",
      date: dates.found && !dates.fuzzy,
      time: time.time !== undefined && !time.fuzzy,
      recurrence: rule !== undefined,
    },
    warnings,
  };
}

/** 규칙이 오늘 이후 처음으로 뜨는 날 */
export function firstOccurrence(rule: RecurrenceRule, today: ISODate): ISODate {
  const dates = ruleDatesInRange(rule, today, {
    from: today,
    to: addDays(today, 366),
  });
  return dates[0] ?? today;
}

/** "15:00" → "오후 3시" */
export function formatTimeKo(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const label = h < 12 ? "오전" : "오후";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${label} ${hour12}시` : `${label} ${hour12}시 ${pad2(m)}분`;
}
