import { describe, expect, it } from "vitest";
import {
  BACKUP_VERSION,
  backupFileName,
  buildBackupFile,
  parseBackupFile,
  type BackupPayload,
} from "./backup";
import { NO_END_DATE } from "./recurrence";
import type { Task } from "./types";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "t1",
    categoryId: "c1",
    title: "보고서",
    startDate: "2026-08-03",
    endDate: "2026-08-03",
    checkMode: "once",
    done: false,
    completedDates: [],
    recurrence: null,
    reminder: "none",
    reminderTime: "09:00",
    sortOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

const payload: BackupPayload = {
  categories: [{ id: "c1", name: "직장", color: "blue", sortOrder: 0 }],
  tasks: [
    task(),
    task({
      id: "t2",
      title: "운동",
      recurrence: { type: "weekly", daysOfWeek: [1, 3] },
      endDate: NO_END_DATE,
      reminder: "10m",
      reminderTime: "07:30",
    }),
    task({
      id: "t3",
      title: "독서",
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      checkMode: "daily",
      completedDates: ["2026-08-01"],
    }),
  ],
  completions: [{ taskId: "t2", date: "2026-08-03" }],
  settings: {
    theme: "dark",
    hideCompleted: true,
    hiddenCategoryIds: ["c1"],
    notifySound: false,
  },
};

function roundTrip(p: BackupPayload = payload) {
  const file = buildBackupFile(p, "2026-08-03T00:00:00.000Z");
  const parsed = parseBackupFile(JSON.stringify(file));
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.file;
}

describe("파일 구조", () => {
  it("version · exportedAt · data를 담는다", () => {
    const file = buildBackupFile(payload, "2026-08-03T00:00:00.000Z");
    expect(file.version).toBe(BACKUP_VERSION);
    expect(file.exportedAt).toBe("2026-08-03T00:00:00.000Z");
    expect(file.data.tasks).toHaveLength(3);
  });

  it("파일 이름에 날짜가 들어간다", () => {
    expect(backupFileName("2026-08-03")).toBe("myquence-backup-2026-08-03.json");
  });

  it("인증 정보는 어디에도 들어가지 않는다", () => {
    // 백업 파일은 메신저로 오가기 마련이다
    const text = JSON.stringify(buildBackupFile(payload, "x"));
    for (const word of ["password", "token", "access_token", "session"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });
});

describe("왕복", () => {
  it("내보낸 것을 그대로 읽어온다", () => {
    const file = roundTrip();
    expect(file.data.categories).toEqual(payload.categories);
    expect(file.data.tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(file.data.completions).toEqual(payload.completions);
    expect(file.data.settings).toEqual(payload.settings);
  });

  it("반복 규칙이 살아 있다", () => {
    const t2 = roundTrip().data.tasks[1];
    expect(t2.recurrence).toEqual({ type: "weekly", daysOfWeek: [1, 3] });
    expect(t2.endDate).toBe(NO_END_DATE);
  });

  it("알림 설정이 살아 있다", () => {
    const t2 = roundTrip().data.tasks[1];
    expect(t2.reminder).toBe("10m");
    expect(t2.reminderTime).toBe("07:30");
  });

  it("기존 daily 데이터가 살아 있다", () => {
    const t3 = roundTrip().data.tasks[2];
    expect(t3.checkMode).toBe("daily");
    expect(t3.completedDates).toEqual(["2026-08-01"]);
  });
});

describe("검증", () => {
  it("JSON이 아니면 거절한다", () => {
    const r = parseBackupFile("{ 이건 JSON이 아님");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("JSON");
  });

  it("version이 없으면 거절한다", () => {
    const r = parseBackupFile(JSON.stringify({ data: { categories: [], tasks: [] } }));
    expect(r.ok).toBe(false);
  });

  it("모르는 버전이면 거절한다", () => {
    // 관대하게 읽으면 알아보지 못한 필드가 사라진 채 덮어쓰기가 끝난다
    const r = parseBackupFile(
      JSON.stringify({ version: 99, data: { categories: [], tasks: [] } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("지원하지 않는 버전");
  });

  it("data가 없으면 거절한다", () => {
    expect(parseBackupFile(JSON.stringify({ version: 1 })).ok).toBe(false);
  });

  it("categories·tasks가 배열이 아니면 거절한다", () => {
    const r = parseBackupFile(
      JSON.stringify({ version: 1, data: { categories: {}, tasks: [] } }),
    );
    expect(r.ok).toBe(false);
  });

  it("빈 백업도 유효하다", () => {
    const r = parseBackupFile(
      JSON.stringify({ version: 1, data: { categories: [], tasks: [] } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.data.tasks).toEqual([]);
      expect(r.file.data.completions).toEqual([]);
      expect(r.file.data.settings.theme).toBe("system");
    }
  });
});

describe("깨진 항목", () => {
  it("살릴 수 없는 항목만 버리고 나머지는 살린다", () => {
    const r = parseBackupFile(
      JSON.stringify({
        version: 1,
        data: {
          categories: [
            { id: "c1", name: "직장", color: "blue", sortOrder: 0 },
            { id: "c2", name: "이상한색", color: "형광핑크", sortOrder: 1 },
          ],
          tasks: [task(), { id: "bad", title: "날짜 없음" }],
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.data.categories.map((c) => c.id)).toEqual(["c1"]);
      expect(r.file.data.tasks.map((t) => t.id)).toEqual(["t1"]);
    }
  });

  it("사라진 카테고리를 가리키는 할일은 미분류가 된다", () => {
    const r = parseBackupFile(
      JSON.stringify({ version: 1, data: { categories: [], tasks: [task()] } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.data.tasks[0].categoryId).toBeNull();
  });

  it("없는 할일을 가리키는 완료 기록은 버린다", () => {
    const r = parseBackupFile(
      JSON.stringify({
        version: 1,
        data: {
          categories: [],
          tasks: [task()],
          completions: [
            { taskId: "t1", date: "2026-08-03" },
            { taskId: "없음", date: "2026-08-03" },
            { taskId: "t1", date: "2026-08-03" }, // 중복
          ],
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.data.completions).toEqual([
      { taskId: "t1", date: "2026-08-03" },
    ]);
  });

  it("반복·알림 필드가 없는 옛 백업도 읽는다", () => {
    // 이 앱의 v1 데이터에는 recurrence도 reminder도 없다
    const r = parseBackupFile(
      JSON.stringify({
        version: 1,
        data: {
          categories: [],
          tasks: [
            {
              id: "old",
              categoryId: null,
              title: "옛 할일",
              startDate: "2026-08-03",
              endDate: "2026-08-03",
              checkMode: "once",
              done: false,
              completedDates: [],
              sortOrder: 0,
              createdAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.data.tasks[0].recurrence).toBeNull();
      expect(r.file.data.tasks[0].reminder).toBe("none");
      expect(r.file.data.tasks[0].reminderTime).toBe("09:00");
    }
  });
});
