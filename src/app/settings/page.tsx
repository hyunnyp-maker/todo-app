"use client";

import Link from "next/link";
import { useState } from "react";
import { getSupabaseClient } from "@/data/supabase/client";

/**
 * 비밀번호 재설정 메일의 링크가 최종적으로 닿는 화면.
 * 콜백에서 이미 세션이 만들어진 상태이므로 새 비밀번호만 받으면 된다.
 */
export default function SettingsPage() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const db = getSupabaseClient();
    if (!db) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await db.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(err.message);
    else {
      setMessage("비밀번호를 바꿨습니다.");
      setPassword("");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-6 py-10">
      <h1 className="text-[20px] font-bold tracking-tight">비밀번호 변경</h1>

      <form onSubmit={submit} className="mt-[18px] flex flex-col gap-[10px]">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="새 비밀번호 (6자 이상)"
          className="w-full rounded-[10px] bg-line-2 px-[12px] py-[11px] text-[13.5px] outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[10px] py-[12px] text-[13.5px] font-medium disabled:opacity-40"
          style={{ background: "var(--ink)", color: "#fff" }}
        >
          {busy ? "처리 중…" : "변경"}
        </button>
      </form>

      {error && (
        <p className="mt-[14px] text-[12px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {message && <p className="mt-[14px] text-[12px] text-ink-2">{message}</p>}

      <Link
        href="/"
        className="mt-[22px] text-[12px] text-ink-3 underline underline-offset-2"
      >
        앱으로 돌아가기
      </Link>
    </main>
  );
}
