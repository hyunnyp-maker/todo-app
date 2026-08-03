import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/** Route Handler 전용 — OAuth 콜백에서 코드를 세션으로 바꿀 때 쓴다 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component에서 호출된 경우 쓰기가 막힌다. 콜백 라우트에서는 정상 동작
        }
      },
    },
  });
}
