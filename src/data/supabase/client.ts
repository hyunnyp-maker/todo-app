"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  isSupabaseConfigured,
} from "@/lib/env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

/** 설정이 없으면 null. 호출부는 게스트 모드로 계속 간다 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  if (!cached) cached = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cached;
}

export type SupabaseClient = NonNullable<ReturnType<typeof getSupabaseClient>>;
