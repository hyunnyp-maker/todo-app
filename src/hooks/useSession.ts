"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { useEffect } from "react";
import { getSupabaseClient } from "@/data/supabase/client";
import { clearQueue } from "@/data/sync/queue";
import { isSupabaseConfigured } from "@/lib/env";

const SESSION_KEY = ["session"] as const;

/**
 * 로그인 세션.
 *
 * Supabase 설정이 없으면 항상 로그아웃 상태로 동작한다 — 게스트 모드가 기본이라
 * 인증이 꺼져 있어도 앱은 온전히 쓸 수 있다 (요구사항 3.1).
 */
export function useSession() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async (): Promise<User | null> => {
      const db = getSupabaseClient();
      if (!db) return null;
      const { data } = await db.auth.getUser();
      return data.user ?? null;
    },
    staleTime: Infinity,
  });

  // 로그인·로그아웃·토큰 갱신을 구독한다.
  // 외부 시스템 구독이므로 콜백에서 캐시를 갱신한다
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db) return;
    const { data } = db.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        qc.setQueryData(SESSION_KEY, session?.user ?? null);
        // 계정이 바뀌면 남의 데이터가 캐시에 남아 있으면 안 된다 (요구사항 3.4)
        qc.removeQueries({ queryKey: ["tasks"] });
        qc.removeQueries({ queryKey: ["categories"] });
        if (_event === "SIGNED_OUT") clearQueue();
      },
    );
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isConfigured: isSupabaseConfigured,
  };
}
