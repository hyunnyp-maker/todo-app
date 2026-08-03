/**
 * 알림 소리 — 음원 파일 없이 Web Audio로 직접 만든다.
 *
 * mp3를 넣지 않은 이유는 두 가지다.
 *   - 첫 방문에 받아야 할 바이트가 늘어난다. 이 앱은 첫 렌더 속도를 지키려고
 *     웹폰트도 안 쓴다 (05-design 3.1).
 *   - 알림음은 0.4초짜리 두 음이면 충분하다. 파일로 둘 만한 내용이 아니다.
 *
 * 브라우저 자동재생 정책상 사용자가 페이지를 한 번이라도 건드리기 전에는
 * AudioContext가 suspended로 시작한다. resume()을 시도하되, 막히면 조용히 포기한다 —
 * 소리가 안 나는 것은 알림 자체의 실패가 아니다.
 */

let ctx: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;

  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext;
  if (!Ctor) return null;

  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** 짧은 한 음. 사인파에 감쇠를 걸어 '띵' 소리를 만든다 */
function tone(audio: AudioContext, freq: number, startAt: number, dur: number) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  // 시작과 끝을 깎지 않으면 딸깍 하는 잡음이 붙는다
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.18, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);

  osc.connect(gain).connect(audio.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

/**
 * 알림음 재생 — 5도 위로 올라가는 두 음.
 * 실패하면 false. 호출부는 이걸로 흐름을 바꾸지 않는다.
 */
export function playChime(): boolean {
  const audio = getContext();
  if (!audio) return false;

  // 사용자 제스처 없이 만든 컨텍스트는 suspended 상태다
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  try {
    const now = audio.currentTime;
    tone(audio, 880, now, 0.18); // A5
    tone(audio, 1318.5, now + 0.13, 0.32); // E6
    return true;
  } catch {
    return false;
  }
}
