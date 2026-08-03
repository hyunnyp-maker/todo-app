"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/voice/MicButton";
import { toneOf } from "@/domain/palette";
import { formatDayShort } from "@/domain/date";
import type { Category, ISODate } from "@/domain/types";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface Props {
  date: ISODate;
  isToday: boolean;
  categories: Category[];
  /** 마지막으로 사용한 카테고리. 기본 선택값이 된다 */
  categoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  onSubmit: (title: string) => void;
  onOpenDetail: (title: string) => void;
  /** 한 문장을 다 들었을 때. 파싱과 확인은 호출부가 한다 */
  onVoiceResult: (text: string) => void;
  /**
   * 다시 듣기 버튼을 이 바깥에서도 누를 수 있게 start를 꽂아 둔다.
   * 음성 상태 전체를 위로 올리지 않는 이유는, 입력창이 여기 있기 때문이다 —
   * 중간 결과를 보여 주려면 상태가 입력창 옆에 있어야 한다
   */
  startRef?: React.MutableRefObject<(() => void) | null>;
}

/**
 * 한 줄 추가 바 — E1. 이 앱에서 가장 중요한 장치.
 *
 * 이탈 1순위가 "적는 게 귀찮아짐"이었다 (03-scenarios S5-b).
 * 그래서 3탭을 1탭으로 줄인다:
 *   - 제목 외 모든 필드에 기본값이 채워져 있다
 *   - Enter 하나로 저장하고, 저장 후에도 닫히지 않아 연속 입력이 된다
 *   - 기간·매일 체크 같은 복잡한 선택지는 [⋯] 뒤로 접어둔다 (P5)
 */
export function QuickAddBar({
  date,
  isToday,
  categories,
  categoryId,
  onCategoryChange,
  onSubmit,
  onOpenDetail,
  onVoiceResult,
  startRef,
}: Props) {
  const [title, setTitle] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 인식이 끝나면 들은 문장을 입력창에 남기고 확인 화면을 연다.
  // 입력창에 남기는 이유는, 확인 화면을 취소해도 손으로 고쳐 쓸 수 있어야 하기 때문이다
  const handleFinish = useCallback(
    (text: string) => {
      setTitle(text);
      onVoiceResult(text);
    },
    [onVoiceResult],
  );

  const speech = useSpeechRecognition({ onFinish: handleFinish });

  useEffect(() => {
    if (!startRef) return;
    startRef.current = speech.start;
    return () => {
      startRef.current = null;
    };
  }, [startRef, speech.start]);

  // 듣는 중에는 중간 결과가 그대로 보인다
  const value = speech.listening ? speech.transcript : title;

  function submit() {
    const value = title.trim();
    // 빈 입력은 아무 일도 일어나지 않는다. 에러 메시지도 띄우지 않는다
    if (value === "") return;
    onSubmit(value);
    setTitle("");
    // 입력창을 닫지 않고 커서를 유지한다 — 연속 입력
    inputRef.current?.focus();
  }

  const placeholder = isToday ? "할일 추가…" : `${formatDayShort(date)}에 추가…`;

  return (
    <div className="sticky bottom-0 flex-none border-t border-line bg-surface pb-[max(9px,env(safe-area-inset-bottom))]">
      {focused && categories.length > 0 && (
        <div className="flex gap-[6px] overflow-x-auto px-[13px] pb-[2px] pt-[8px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((c) => {
            const on = c.id === categoryId;
            const tone = toneOf(c.color);
            return (
              <button
                key={c.id}
                type="button"
                // 포커스가 입력창에서 빠져나가면 칩이 사라져 탭이 먹히지 않는다
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onCategoryChange(c.id);
                  inputRef.current?.focus();
                }}
                aria-pressed={on}
                className="shrink-0 overflow-hidden whitespace-nowrap rounded-full px-[11px] py-[5px] text-[11px] font-bold"
                style={
                  on
                    ? { background: tone.cp, color: "#ffffff" }
                    : { background: "var(--line-2)", color: "var(--ink-3)" }
                }
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {/* 입력란이 눈에 안 들어온다는 지적을 받아, 옅은 판 위에 얹고 글자를 굵혔다.
          하단 바는 이 앱에서 가장 자주 쓰는 곳이라 존재감이 있어야 한다 (E1) */}
      {/* 듣는 중임을 색이 아니라 글자로도 알린다. 오류도 같은 줄에 뜬다 */}
      {(speech.listening || speech.error || !speech.supported) && (
        <p
          role="status"
          aria-live="polite"
          className="px-[15px] pt-[6px] text-[11px] leading-[1.5]"
          style={{ color: speech.error ? "var(--danger)" : "var(--ink-3)" }}
        >
          {speech.error
            ? speech.error
            : speech.listening
              ? "● 듣는 중… 다시 누르면 멈춥니다"
              : "이 브라우저는 음성 인식을 지원하지 않습니다. 직접 입력해 주세요."}
        </p>
      )}

      <div className="px-[11px] py-[8px]">
        <div
          className="flex items-center gap-[9px] rounded-[12px] px-[12px] py-[10px]"
          style={{ background: "var(--line-2)" }}
        >
        <span aria-hidden className="text-[15px] font-semibold text-ink-2">
          ✎
        </span>
        <input
          ref={inputRef}
          value={value}
          readOnly={speech.listening}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            // 한글 조합 중의 Enter는 확정용이다. 이걸 저장으로 받으면 중복 저장된다.
            // E1의 성패가 이 한 줄에 달려 있다 (04-engagement E1 엣지 케이스)
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            submit();
          }}
          placeholder={placeholder}
          aria-label="할일 추가"
          enterKeyHint="done"
          // 자동 대문자·자동수정은 할일 제목에 방해만 된다
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // 글자 크기는 globals.css가 터치 기기에서 16px로 올린다 (iOS 자동 확대 방지)
          className="min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold outline-none placeholder:font-semibold placeholder:text-ink-2"
        />
        <MicButton
          supported={speech.supported}
          listening={speech.listening}
          onStart={speech.start}
          onStop={speech.stop}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onOpenDetail(title.trim())}
          aria-label="자세히 입력"
          className="px-1 text-[15px] font-semibold text-ink-2"
        >
          ⋯
        </button>
        </div>
      </div>
    </div>
  );
}
