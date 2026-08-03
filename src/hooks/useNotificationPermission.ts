"use client";

import { useSyncExternalStore } from "react";
import {
  permissionServerSnapshot,
  permissionSnapshot,
  requestPermission,
  subscribePermission,
  type PermissionState,
} from "@/lib/notifications";

export interface NotificationPermissionState {
  permission: PermissionState;
  supported: boolean;
  granted: boolean;
  denied: boolean;
  request: () => Promise<PermissionState>;
}

/**
 * 알림 권한 상태.
 *
 * useEffect + setState 대신 useSyncExternalStore를 쓴다 —
 * 렌더 직후 상태를 한 번 더 갱신하면 첫 프레임이 항상 틀린 값으로 그려진다.
 */
export function useNotificationPermission(): NotificationPermissionState {
  const permission = useSyncExternalStore(
    subscribePermission,
    permissionSnapshot,
    permissionServerSnapshot,
  );

  return {
    permission,
    supported: permission !== "unsupported",
    granted: permission === "granted",
    denied: permission === "denied",
    request: requestPermission,
  };
}
