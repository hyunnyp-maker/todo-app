/**
 * 음성 인식 — Web Speech API의 얇은 껍데기.
 *
 * 한계를 먼저 적어 둔다. 코드로 덮을 수 없는 것들이다.
 *
 *   1. 브라우저마다 지원이 갈린다. Chrome·Edge는 되고, Firefox는 되지 않는다.
 *      iOS Safari는 16.4부터 webkitSpeechRecognition이 있지만 동작이 다르고 중간 결과가 없다.
 *   2. 대부분의 구현이 음성을 서버로 보내 처리한다. 오프라인에서는 실패한다.
 *   3. 결과가 항상 정확하지 않다. 동음이의어와 고유명사에서 특히 그렇다.
 *      그래서 이 앱은 인식 결과를 바로 저장하지 않는다 — 반드시 확인 화면을 거친다.
 *
 * 브라우저 전역 타입에 기대지 않고 필요한 부분만 직접 선언한다.
 * lib.dom의 정의는 TypeScript 버전에 따라 있기도 없기도 해서, 있으면 있는 대로 충돌한다.
 */

export interface SpeechAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

export interface SpeechResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: SpeechAlternativeLike;
}

export interface SpeechResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechResultLike;
}

export interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechResultListLike;
}

export interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: ((event: Event) => void) | null;
}

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}

/** 표준 이름이 먼저, 없으면 webkit 접두사 */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export const SPEECH_LANG = "ko-KR";

/** 새 인식기. 지원하지 않으면 null */
export function createRecognition(): SpeechRecognitionLike | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = SPEECH_LANG;
  // 한 문장만 받는다. 계속 켜 두면 배터리와 개인정보 양쪽에서 손해다
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  return recognition;
}

/**
 * 오류 코드를 사람이 읽을 문장으로.
 * 코드를 그대로 보여 주면 사용자는 무엇을 해야 할지 알 수 없다.
 */
export function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "마이크 권한이 거부되었습니다. 주소창의 자물쇠 → 마이크에서 허용으로 바꿔 주세요.";
    case "no-speech":
      return "말소리를 듣지 못했습니다. 다시 시도해 주세요.";
    case "audio-capture":
      return "마이크를 찾지 못했습니다. 연결 상태를 확인해 주세요.";
    case "network":
      return "네트워크 오류로 음성 인식에 실패했습니다. 직접 입력해 주세요.";
    case "aborted":
      return "";
    default:
      return "음성 인식에 실패했습니다. 직접 입력해 주세요.";
  }
}

/** 결과 목록에서 이번에 확정된/중간 텍스트를 뽑는다 */
export function readTranscript(results: SpeechResultListLike): {
  text: string;
  isFinal: boolean;
} {
  let text = "";
  let isFinal = false;
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.length === 0) continue;
    text += result[0].transcript;
    if (result.isFinal) isFinal = true;
  }
  return { text: text.trim(), isFinal };
}
