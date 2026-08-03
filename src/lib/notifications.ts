/**
 * 브라우저 알림 — 얇은 껍데기.
 *
 * 기술적 한계를 먼저 적어 둔다. 이 한계는 코드로 극복할 수 없다.
 *
 *   1. 웹 페이지의 알림은 앱이 열려 있을 때만 예약·발송된다.
 *      탭을 완전히 닫으면 예약된 알림은 사라진다.
 *   2. 진짜 백그라운드 알림에는 Push API가 필요하고, 그건 서버(VAPID·푸시 구독)와
 *      사용자별 발송 스케줄러를 요구한다. 이번 범위 밖이다.
 *   3. iOS Safari는 홈 화면에 추가한 PWA에서만 알림을 허용한다.
 *      브라우저 탭에서는 Notification 자체가 없거나 권한을 주지 않는다.
 *
 * 그래서 UI에서도 "앱이 열려 있을 때만"이라고 분명히 말한다.
 * 조용히 안 울리는 것보다 못 울린다고 미리 말하는 편이 낫다.
 */

const FIRED_KEY = "todo-app:reminders:fired:v1";

/** 하루가 지난 기록은 지운다 — 무한정 쌓일 이유가 없다 */
const KEEP_DAYS = 3;

export type PermissionState = NotificationPermission | "unsupported";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): PermissionState {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

// ── 권한 변화 구독 ─────────────────────────────
// Notification.permission은 이벤트를 주지 않는다. 우리가 바꿀 때만 알리면 충분하다.

const listeners = new Set<() => void>();
let snapshot: PermissionState = "default";
let snapshotReady = false;

function refresh() {
  const next = getPermission();
  if (next === snapshot && snapshotReady) return;
  snapshot = next;
  snapshotReady = true;
  for (const l of listeners) l();
}

export function subscribePermission(listener: () => void): () => void {
  listeners.add(listener);
  refresh();
  return () => {
    listeners.delete(listener);
  };
}

export function permissionSnapshot(): PermissionState {
  if (!snapshotReady) {
    snapshot = getPermission();
    snapshotReady = true;
  }
  return snapshot;
}

/** 서버 렌더 시점에는 알 수 없다. 하이드레이션 불일치를 피하려고 고정값을 준다 */
export function permissionServerSnapshot(): PermissionState {
  return "unsupported";
}

/**
 * 권한 요청 — 사용자가 알림을 켜는 순간에만 부른다.
 * 앱 시작 시 자동으로 부르지 않는다.
 */
export async function requestPermission(): Promise<PermissionState> {
  if (!isNotificationSupported()) return "unsupported";
  try {
    const result = await Notification.requestPermission();
    refresh();
    return result;
  } catch {
    refresh();
    return getPermission();
  }
}

// ── 중복 발송 방지 ─────────────────────────────

interface FiredEntry {
  key: string;
  at: number;
}

function loadFiredEntries(): FiredEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FIRED_KEY);
    if (!raw) return [];
    const json: unknown = JSON.parse(raw);
    if (!Array.isArray(json)) return [];
    return json.filter(
      (e): e is FiredEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as FiredEntry).key === "string" &&
        typeof (e as FiredEntry).at === "number",
    );
  } catch {
    return [];
  }
}

/** 이미 울린 알림 키 — 같은 할일·같은 날짜·같은 설정은 한 번만 */
export function loadFired(now: number = Date.now()): Set<string> {
  const cutoff = now - KEEP_DAYS * 24 * 60 * 60 * 1000;
  return new Set(
    loadFiredEntries()
      .filter((e) => e.at >= cutoff)
      .map((e) => e.key),
  );
}

export function markFired(keys: readonly string[], now: number = Date.now()) {
  if (typeof window === "undefined" || keys.length === 0) return;
  const cutoff = now - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const kept = loadFiredEntries().filter((e) => e.at >= cutoff);
  const next = [...kept, ...keys.map((key) => ({ key, at: now }))];
  try {
    window.localStorage.setItem(FIRED_KEY, JSON.stringify(next));
  } catch {
    /* 저장에 실패해도 알림 자체는 이미 울렸다 */
  }
}

/** 실제 발송. 권한이 없으면 아무 일도 하지 않는다 */
export function showNotification(title: string, body: string): boolean {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // 같은 태그면 알림 센터에 하나만 남는다
      tag: `myquence:${title}:${body}`,
    });
    return true;
  } catch {
    return false;
  }
}
