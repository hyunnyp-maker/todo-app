"use client";

import { useMemo } from "react";
import { localRepository } from "@/data/local/localRepository";
import type { TodoRepository } from "@/data/repository";
import { getSupabaseClient } from "@/data/supabase/client";
import { SupabaseRepository } from "@/data/supabase/supabaseRepository";
import { useSession } from "./useSession";

/**
 * 저장소 선택 — 06-architecture 4.1
 *
 * 세션이 있으면 Supabase, 없으면 localStorage.
 * 컴포넌트는 자기가 게스트인지 로그인인지 끝까지 알지 못한다.
 */
export function useRepository(): TodoRepository {
  const { user } = useSession();

  return useMemo(() => {
    const db = getSupabaseClient();
    if (user && db) return new SupabaseRepository(db);
    return localRepository;
  }, [user]);
}

/**
 * 캐시 네임스페이스.
 * 계정마다 달라야 로그아웃 후 남의 데이터가 잠깐 보이는 일이 없다.
 */
export function useOwnerScope(): string {
  const { user } = useSession();
  return user?.id ?? "guest";
}
