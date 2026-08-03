"use client";

import { useSyncExternalStore } from "react";
import {
  installServerSnapshot,
  installSnapshot,
  subscribeInstall,
  type InstallMode,
} from "@/lib/install";

/**
 * 홈 화면 설치 가능 여부.
 *
 * useEffect + setState 대신 useSyncExternalStore를 쓴다.
 * 이벤트(beforeinstallprompt)로 뒤늦게 바뀌는 값이라 구독이 맞고,
 * 렌더 중 setState를 하지 않아 하이드레이션도 어긋나지 않는다.
 */
export function useInstallPrompt(): InstallMode {
  return useSyncExternalStore(
    subscribeInstall,
    installSnapshot,
    installServerSnapshot,
  );
}
