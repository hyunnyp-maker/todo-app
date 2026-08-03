/**
 * 홈 화면에 추가 — 플랫폼마다 가능한 것이 다르다.
 *
 *   Android Chrome / 데스크톱 Chrome·Edge
 *     beforeinstallprompt 이벤트를 잡아 뒀다가 버튼에서 prompt()를 부른다. 진짜 설치 버튼이 된다.
 *
 *   iOS Safari
 *     설치를 코드로 띄우는 API가 아예 없다. beforeinstallprompt도 오지 않는다.
 *     공유 시트 → '홈 화면에 추가'가 유일한 경로다.
 *     그래서 여기서는 버튼 대신 단계를 적어 준다 — 눌러도 아무 일이 없는 버튼을 두는 것보다 낫다.
 *
 *   그 외 (Firefox, iOS Chrome 등)
 *     브라우저 메뉴에 항목이 있거나 없다. 메뉴를 열어 보라고만 한다.
 */

export type InstallMode =
  /** 서버 렌더·판정 전 */
  | "unknown"
  /** 이미 홈 화면에서 실행 중 */
  | "installed"
  /** 설치 프롬프트를 띄울 수 있다 */
  | "prompt"
  /** iOS — 공유 시트로만 가능 */
  | "ios"
  /** 브라우저 메뉴로만 가능 */
  | "manual";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let snapshot: InstallMode = "unknown";
let attached = false;
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari는 display-mode를 제대로 알리지 않는다. 비표준 navigator.standalone을 본다
  return (window.navigator as { standalone?: boolean }).standalone === true;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  // iPadOS 13+ 는 자신을 Mac이라고 말한다. 터치 지원 여부로 가른다
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function compute(): InstallMode {
  if (typeof window === "undefined") return "unknown";
  if (isStandalone()) return "installed";
  if (deferred) return "prompt";
  if (isIOS()) return "ios";
  return "manual";
}

function emit() {
  const next = compute();
  if (next === snapshot) return;
  snapshot = next;
  for (const l of listeners) l();
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);

  if (!attached && typeof window !== "undefined") {
    attached = true;
    window.addEventListener("beforeinstallprompt", (e) => {
      // 기본 배너를 막고 우리 버튼으로 옮긴다.
      // 설치 유도 팝업을 자동으로 띄우지 않는 것이 원래 방침이다 (E2)
      e.preventDefault();
      deferred = e as InstallPromptEvent;
      emit();
    });
    window.addEventListener("appinstalled", () => {
      deferred = null;
      emit();
    });
  }

  snapshot = compute();
  return () => {
    listeners.delete(listener);
  };
}

export function installSnapshot(): InstallMode {
  return snapshot;
}

/** 서버에서는 브라우저를 알 수 없다. 하이드레이션 불일치를 피하려고 고정값 */
export function installServerSnapshot(): InstallMode {
  return "unknown";
}

/**
 * 설치 프롬프트를 띄운다. 프롬프트가 없으면 false.
 * 한 번 쓴 이벤트는 재사용할 수 없어 즉시 버린다.
 */
export async function promptInstall(): Promise<boolean> {
  const event = deferred;
  if (!event) return false;
  deferred = null;
  try {
    await event.prompt();
    await event.userChoice;
  } catch {
    /* 사용자가 닫았거나 브라우저가 거부했다 */
  }
  emit();
  return true;
}
