"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Brand } from "@/components/Brand";

// Placeholder passcode. This is only a casual lock (it ships in the front-end code).
// Replace with real host login (e.g. Supabase Auth) when the backend is added.
const PASSCODE = "password123";
const KEY = "p30:admin";
const EVT = "p30:admin-auth";

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

function snapshot() {
  try {
    return localStorage.getItem(KEY) === PASSCODE ? "in" : "out";
  } catch {
    return "out";
  }
}

export function AdminGate({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribe, snapshot, () => "loading");
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);

  if (status === "loading") return <main className="flex-1" />;
  if (status === "in") return <>{children}</>;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <Brand size="lg" />
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (code === PASSCODE) {
            try {
              localStorage.setItem(KEY, code);
            } catch {}
            window.dispatchEvent(new Event(EVT));
          } else {
            setBad(true);
          }
        }}
      >
        <div className="flex items-center justify-center gap-2 text-sm font-semibold text-white/70">
          <Lock className="size-4" /> Host access
        </div>
        <label htmlFor="code" className="sr-only">Passcode</label>
        <input
          id="code"
          type="password"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setBad(false);
          }}
          placeholder="Passcode"
          autoComplete="current-password"
          className="rounded-2xl border border-line bg-panel px-4 py-4 text-lg outline-none placeholder:text-white/30 focus:border-brand"
        />
        {bad && <p role="alert" className="text-center text-sm text-brand2">Wrong passcode.</p>}
        <button className="rounded-2xl bg-brand py-4 text-lg font-bold shadow-[0_0_24px_rgba(255,42,61,0.45)] active:scale-[0.98]">
          Unlock
        </button>
      </form>
    </main>
  );
}
