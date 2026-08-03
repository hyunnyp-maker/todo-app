"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { getSupabaseClient } from "@/data/supabase/client";
import { isSupabaseConfigured, siteOrigin } from "@/lib/env";

export type AuthMode = "login" | "signup" | "reset";

const TITLES: Record<AuthMode, string> = {
  login: "로그인",
  signup: "가입하기",
  reset: "비밀번호 재설정",
};

/**
 * 인증 화면.
 *
 * 로그인은 선택이지 관문이 아니다 — 게스트로도 앱을 전부 쓸 수 있다 (03-scenarios S8).
 * 그래서 어느 화면에서든 "로그인 없이 계속 쓰기"로 돌아갈 수 있게 둔다.
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const db = getSupabaseClient();

  async function run(fn: () => Promise<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } = await fn();
    setBusy(false);
    if (err) setError(err.message);
    return !err;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;

    if (mode === "login") {
      const ok = await run(() =>
        db.auth.signInWithPassword({ email, password }),
      );
      if (ok) router.replace("/");
      return;
    }

    if (mode === "signup") {
      const ok = await run(() =>
        db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${siteOrigin()}/auth/callback` },
        }),
      );
      if (ok) setNotice("확인 메일을 보냈습니다. 메일의 링크를 눌러주세요.");
      return;
    }

    const ok = await run(() =>
      db.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteOrigin()}/auth/callback?next=/settings`,
      }),
    );
    if (ok) setNotice("재설정 메일을 보냈습니다.");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-6 py-10">
      <Brand size="lg" />
      <h1 className="mt-[18px] text-[17px] font-bold tracking-tight">
        {TITLES[mode]}
      </h1>
      <p className="mt-[6px] text-[12.5px] leading-[1.6] text-ink-3">
        지금은 <b className="font-medium text-ink-2">게스트 모드</b>라 이 브라우저에만
        저장됩니다. 가입하면 <b className="font-medium text-ink-2">이메일 계정</b> 기준으로
        저장돼, 다른 기기에서도 이어서 쓸 수 있어요.
      </p>

      {!isSupabaseConfigured && (
        <p
          className="mt-[16px] rounded-[10px] bg-line-2 px-[12px] py-[10px] text-[12px] leading-[1.6]"
          style={{ color: "var(--danger)" }}
        >
          Supabase가 아직 설정되지 않았습니다. <code>.env.local</code>에 URL과 anon
          key를 넣어주세요. 그때까지는 게스트 모드로 쓸 수 있습니다.
        </p>
      )}

      <form onSubmit={submit} className="mt-[20px] flex flex-col gap-[10px]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="이메일"
          className="w-full rounded-[10px] bg-line-2 px-[12px] py-[11px] text-[13.5px] outline-none"
        />
        {mode !== "reset" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="비밀번호 (6자 이상)"
            className="w-full rounded-[10px] bg-line-2 px-[12px] py-[11px] text-[13.5px] outline-none"
          />
        )}

        <button
          type="submit"
          disabled={busy || !isSupabaseConfigured}
          className="mt-[4px] w-full rounded-[10px] py-[12px] text-[13.5px] font-medium disabled:opacity-40"
          style={{ background: "var(--ink)", color: "#fff" }}
        >
          {busy ? "처리 중…" : TITLES[mode]}
        </button>
      </form>

      {error && (
        <p className="mt-[14px] text-[12px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {notice && <p className="mt-[14px] text-[12px] text-ink-2">{notice}</p>}

      <div className="mt-[22px] flex flex-col gap-[8px] text-[12px] text-ink-3">
        {mode === "login" && (
          <>
            <Link href="/signup" className="underline underline-offset-2">
              계정이 없으신가요? 가입하기
            </Link>
            <Link href="/reset" className="underline underline-offset-2">
              비밀번호를 잊으셨나요?
            </Link>
          </>
        )}
        {mode !== "login" && (
          <Link href="/login" className="underline underline-offset-2">
            로그인으로 돌아가기
          </Link>
        )}
        <Link href="/" className="mt-[6px] underline underline-offset-2">
          로그인 없이 계속 쓰기
        </Link>
      </div>
    </main>
  );
}
