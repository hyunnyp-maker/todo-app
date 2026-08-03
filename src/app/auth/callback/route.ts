import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * OAuth · 메일 링크가 돌아오는 자리.
 * 받은 code를 세션으로 교환하고 쿠키에 심은 뒤 앱으로 보낸다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!isSupabaseConfigured) {
    return NextResponse.redirect(`${origin}/login?error=not_configured`);
  }

  if (code) {
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=callback`);
}
