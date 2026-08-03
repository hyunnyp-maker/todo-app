"use client";

interface Props {
  supported: boolean;
  listening: boolean;
  onStart: () => void;
  onStop: () => void;
}

/**
 * 마이크 버튼 — 하단 입력 바 안에 산다.
 *
 * 상태를 색으로만 알리지 않는다. 듣는 중에는 아이콘 모양이 사각형(정지)으로 바뀌고
 * aria-label과 aria-pressed도 함께 바뀐다. 색만으로 구분하면 색각 이상에서 사라진다.
 */
export function MicButton({ supported, listening, onStart, onStop }: Props) {
  const label = !supported
    ? "이 브라우저는 음성 인식을 지원하지 않습니다"
    : listening
      ? "음성 입력 중지"
      : "음성으로 할일 추가";

  return (
    <button
      type="button"
      disabled={!supported}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => (listening ? onStop() : onStart())}
      aria-label={label}
      aria-pressed={listening}
      title={label}
      className="flex size-[44px] shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-35"
      style={{
        background: listening ? "var(--danger)" : "transparent",
        color: listening ? "#ffffff" : "var(--ink-2)",
      }}
    >
      {listening ? (
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2.5" />
        </svg>
      ) : (
        <svg
          aria-hidden
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      )}
    </button>
  );
}
