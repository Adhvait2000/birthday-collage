"use client";

import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Brand } from "@/components/Brand";
import { signIn, useAuthStatus } from "@/lib/auth";

// Host login via Supabase Auth. Sign-ups are disabled in the Supabase dashboard,
// so the only account that can log in is the one you created there.
export function AdminGate({ children }: { children: ReactNode }) {
  const status = useAuthStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "loading") return <main className="flex-1" />;
  if (status === "in") return <>{children}</>;

  const input =
    "rounded-2xl border border-line bg-panel px-4 py-4 text-lg outline-none placeholder:text-white/30 focus:border-brand";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <Brand size="lg" />
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          const err = await signIn(email, password);
          if (err) setError(err);
          setBusy(false);
        }}
      >
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white/70">
          <Lock className="size-4" /> Host access
        </div>
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
          className={input}
        />
        <label htmlFor="password" className="sr-only">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className={input}
        />
        {error && <p role="alert" className="text-center text-sm text-brand2">{error}</p>}
        <button
          disabled={busy || !email || !password}
          className="rounded-2xl bg-brand py-4 text-lg font-bold shadow-[0_0_24px_rgba(255,42,61,0.45)] active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}