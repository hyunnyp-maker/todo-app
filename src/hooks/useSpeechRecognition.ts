"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  createRecognition,
  isSpeechSupported,
  readTranscript,
  speechErrorMessage,
  type SpeechRecognitionLike,
} from "@/lib/speech";

/** 지원 여부는 바뀌지 않는다. 구독은 형식만 갖춘다 */
const noopSubscribe = () => () => {};
const serverSupported = () => false;

export interface SpeechState {
  supported: boolean;
  listening: boolean;
  /** 인식 중에는 중간 결과, 끝나면 최종 결과 */
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

interface Options {
  /** 한 문장이 끝났을 때. 확인 화면은 여기서 연다 */
  onFinish?: (text: string) => void;
}

/**
 * 음성 인식 훅.
 *
 * 권한은 start()에서만 요청된다 — 브라우저가 recognition.start() 시점에 마이크를 묻는다.
 * 앱이 열릴 때 훅이 마운트되는 것만으로는 아무 일도 일어나지 않는다.
 *
 * 지원 여부를 useSyncExternalStore로 읽는 이유는 서버 렌더 때문이다.
 * useState 초기값으로 읽으면 서버(false)와 클라이언트(true)가 어긋나 하이드레이션이 깨진다.
 */
export function useSpeechRecognition({ onFinish }: Options = {}): SpeechState {
  const supported = useSyncExternalStore(
    noopSubscribe,
    isSpeechSupported,
    serverSupported,
  );

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  // 화면을 떠날 때 마이크를 놓는다. 켜 둔 채로 두면 표시등이 남는다
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setError(null);
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) return;

    const recognition = createRecognition();
    if (!recognition) {
      setError("이 브라우저는 음성 인식을 지원하지 않습니다. 직접 입력해 주세요.");
      return;
    }

    finalRef.current = "";
    setTranscript("");
    setError(null);

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      const { text } = readTranscript(event.results);
      finalRef.current = text;
      setTranscript(text);
    };

    recognition.onerror = (event) => {
      const message = speechErrorMessage(event.error);
      // aborted는 사용자가 직접 멈춘 것이다. 오류로 알릴 일이 아니다
      if (message) setError(message);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const text = finalRef.current.trim();
      if (text !== "") finishRef.current?.(text);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // 이미 돌고 있거나 브라우저가 거부했다
      recognitionRef.current = null;
      setListening(false);
      setError("음성 인식을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }, []);

  return { supported, listening, transcript, error, start, stop, reset };
}
