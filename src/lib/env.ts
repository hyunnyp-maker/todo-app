/**
 * 환경변수 — 06-architecture.md 5.1
 *
 * 설정이 없어도 앱은 죽지 않는다. 게스트 모드로 계속 동작하고 인증만 꺼진다.
 * .env.local을 채우면 로그인 기능이 저절로 켜진다.
 *
 * NEXT_PUBLIC_ 접두사가 붙은 값만 클라이언트로 나간다.
 * service role key는 이 파일에도, 어디에도 두지 않는다.
 */

// process.env는 빌드 시점에 치환되므로 반드시 통째로 적어야 한다
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/** OAuth·메일 링크가 돌아올 주소 */
export function siteOrigin(): string {
  if (SITE_URL) return SITE_URL.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}
