"use client";

import { useEffect } from "react";

/**
 * 서비스 워커 등록 — E2
 *
 * 설치 유도 팝업은 띄우지 않는다 (04-engagement E2).
 * 서지호(첫 방문자)에게 권한·설치 팝업을 들이미는 순간 창이 닫힌다.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록에 실패해도 앱은 그대로 동작한다. 오프라인 실행만 안 될 뿐
    });
  }, []);

  return null;
}
