// @vitest-environment jsdom
/**
 * 음성 입력 UI 테스트.
 *
 * SpeechRecognition은 jsdom에 없다. window에 가짜 생성자를 심어
 * onstart/onresult/onerror/onend를 우리가 직접 발화시킨다.
 * 실제 마이크나 네트워크는 건드리지 않는다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuickAddBar } from "@/components/input/QuickAddBar";
import { VoiceConfirmSheet } from "@/components/voice/VoiceConfirmSheet";
import { LocalRepository } from "@/data/local/localRepository";
import { parseVoiceTodo } from "@/domain/voiceParse";
import { buildTask } from "@/hooks/useTaskMutations";
import type {
  SpeechRecognitionErrorEventLike,
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
} from "@/lib/speech";

const NOW = new Date(2026, 7, 3); // 월요일

// ── 가짜 SpeechRecognition ─────────────────────

class FakeRecognition implements SpeechRecognitionLike {
  static last: FakeRecognition | null = null;
  static started = 0;

  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;

  onstart: ((e: Event) => void) | null = null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null = null;
  onend: ((e: Event) => void) | null = null;

  stopped = false;

  constructor() {
    FakeRecognition.last = this;
  }

  start() {
    FakeRecognition.started += 1;
    this.onstart?.(new Event("start"));
  }

  stop() {
    this.stopped = true;
  }

  abort() {
    this.stopped = true;
  }

  // ── 테스트에서 부르는 것들 ──

  emit(transcript: string, isFinal: boolean) {
    const results = {
      length: 1,
      0: { length: 1, isFinal, 0: { transcript, confidence: 0.9 } },
    };
    (this.onresult as ((e: unknown) => void) | null)?.({ resultIndex: 0, results });
  }

  fail(code: string) {
    (this.onerror as ((e: unknown) => void) | null)?.({ error: code });
  }

  end() {
    this.onend?.(new Event("end"));
  }
}

function installSpeech() {
  FakeRecognition.last = null;
  FakeRecognition.started = 0;
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition =
    FakeRecognition;
}

function removeSpeech() {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as unknown as { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
}

function renderBar(onVoiceResult = vi.fn()) {
  render(
    <QuickAddBar
      date="2026-08-03"
      isToday
      categories={[]}
      categoryId={null}
      onCategoryChange={() => {}}
      onSubmit={() => {}}
      onOpenDetail={() => {}}
      onVoiceResult={onVoiceResult}
    />,
  );
  return onVoiceResult;
}

afterEach(() => {
  cleanup();
  removeSpeech();
});

describe("마이크 버튼", () => {
  it("지원하지 않는 브라우저에서는 비활성화하고 안내를 띄운다", () => {
    removeSpeech();
    renderBar();

    const mic = screen.getByRole("button", {
      name: /지원하지 않습니다/,
    });
    expect((mic as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("지원하지 않습니다");
  });

  it("누르면 인식을 시작하고 다시 누르면 멈춘다", () => {
    installSpeech();
    renderBar();

    const mic = screen.getByRole("button", { name: "음성으로 할일 추가" });
    expect(FakeRecognition.started).toBe(0); // 앱이 뜬 것만으로는 마이크를 켜지 않는다

    fireEvent.click(mic);
    expect(FakeRecognition.started).toBe(1);
    expect(FakeRecognition.last?.lang).toBe("ko-KR");

    // 듣는 중은 색이 아니라 글자로도 드러난다
    expect(screen.getByRole("status").textContent).toContain("듣는 중");

    fireEvent.click(screen.getByRole("button", { name: "음성 입력 중지" }));
    expect(FakeRecognition.last?.stopped).toBe(true);
  });

  it("인식 결과를 입력창에 보여 준다", () => {
    installSpeech();
    renderBar();

    fireEvent.click(screen.getByRole("button", { name: "음성으로 할일 추가" }));
    act(() => FakeRecognition.last!.emit("내일 오후 3시 병원 예약", false));

    const input = screen.getByLabelText("할일 추가") as HTMLInputElement;
    expect(input.value).toBe("내일 오후 3시 병원 예약");
  });

  it("한 문장이 끝나면 결과를 호출부에 넘긴다", () => {
    installSpeech();
    const onVoiceResult = renderBar();

    fireEvent.click(screen.getByRole("button", { name: "음성으로 할일 추가" }));
    act(() => {
      FakeRecognition.last!.emit("내일 병원 예약", true);
      FakeRecognition.last!.end();
    });

    expect(onVoiceResult).toHaveBeenCalledWith("내일 병원 예약");
  });

  it("권한이 거부되면 무엇을 해야 할지 알려 준다", () => {
    installSpeech();
    renderBar();

    fireEvent.click(screen.getByRole("button", { name: "음성으로 할일 추가" }));
    act(() => {
      FakeRecognition.last!.fail("not-allowed");
      FakeRecognition.last!.end();
    });

    expect(screen.getByRole("status").textContent).toContain("마이크 권한이 거부");
    // 음성이 막혀도 손으로는 계속 쓸 수 있어야 한다
    const input = screen.getByLabelText("할일 추가") as HTMLInputElement;
    expect(input).not.toHaveProperty("readOnly", true);
    fireEvent.change(input, { target: { value: "직접 입력" } });
    expect(input.value).toBe("직접 입력");
  });

  it("네트워크 오류도 사람이 읽을 문장으로 알린다", () => {
    installSpeech();
    renderBar();

    fireEvent.click(screen.getByRole("button", { name: "음성으로 할일 추가" }));
    act(() => {
      FakeRecognition.last!.fail("network");
      FakeRecognition.last!.end();
    });

    expect(screen.getByRole("status").textContent).toContain("네트워크");
  });
});

describe("확인 화면", () => {
  const parsed = parseVoiceTodo("내일 오후 3시 병원 예약", NOW);

  function renderSheet(overrides: Partial<Parameters<typeof VoiceConfirmSheet>[0]> = {}) {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <VoiceConfirmSheet
        open
        parsed={parsed}
        fallbackDate="2026-08-03"
        categoryId={null}
        onClose={onClose}
        onRetry={() => {}}
        onSave={onSave}
        {...overrides}
      />,
    );
    return { onSave, onClose };
  }

  it("원문과 파싱 결과를 보여 준다", () => {
    renderSheet();

    expect(screen.getByText("내일 오후 3시 병원 예약")).toBeTruthy();
    expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe("병원 예약");
    expect((screen.getByLabelText("시작 날짜") as HTMLInputElement).value).toBe(
      "2026-08-04",
    );
    expect((screen.getByLabelText("시간") as HTMLInputElement).value).toBe("15:00");
  });

  it("저장을 누르기 전에는 아무것도 만들지 않는다", () => {
    const { onSave, onClose } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("고친 뒤 저장하면 고친 값이 넘어간다", () => {
    const { onSave } = renderSheet();

    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "치과 예약" },
    });
    fireEvent.change(screen.getByLabelText("시작 날짜"), {
      target: { value: "2026-08-06" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: "치과 예약",
      startDate: "2026-08-06",
      reminder: "at",
      reminderTime: "15:00",
    });
  });

  it("제목이 비면 저장할 수 없다", () => {
    const { onSave } = renderSheet();

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "  " } });

    const save = screen.getByRole("button", { name: "저장" });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("파싱이 실패한 입력도 고쳐서 저장할 수 있다", () => {
    // 제목을 못 건진 경우 — 날짜와 시간만 들렸다
    const broken = parseVoiceTodo("내일 3시", NOW);
    const { onSave } = renderSheet({ parsed: broken });

    expect(broken.title).toBe("");
    expect(broken.warnings.length).toBeGreaterThan(0);
    expect((screen.getByRole("button", { name: "저장" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "회의" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(onSave.mock.calls[0][0]).toMatchObject({ title: "회의" });
  });

  it("반복이 들어 있으면 규칙을 그대로 넘긴다", () => {
    const weekly = parseVoiceTodo("매주 화요일과 목요일 운동", NOW);
    const { onSave } = renderSheet({ parsed: weekly });

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      title: "운동",
      recurrence: { type: "weekly", daysOfWeek: [2, 4] },
    });
  });
});

describe("저장 경로", () => {
  beforeEach(() => window.localStorage.clear());

  it("확인 화면이 넘긴 초안이 기존 저장소에 그대로 들어간다", async () => {
    const repo = new LocalRepository();
    let saved: Promise<unknown> = Promise.resolve();
    render(
      <VoiceConfirmSheet
        open
        parsed={parseVoiceTodo("내일 오후 3시 병원 예약", NOW)}
        fallbackDate="2026-08-03"
        categoryId={null}
        onClose={() => {}}
        onRetry={() => {}}
        // AppShell이 하는 것과 같다 — 초안을 buildTask에 넣고 저장소로 보낸다.
        // 음성 전용 저장 경로는 없다
        onSave={(draft) => {
          saved = repo.createTask(buildTask(draft));
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await saved;

    const tasks = await repo.listTasks({ from: "2026-08-01", to: "2026-08-31" });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: "병원 예약",
      startDate: "2026-08-04",
      reminder: "at",
      reminderTime: "15:00",
    });
  });
});
