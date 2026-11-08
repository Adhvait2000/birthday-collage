"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

export type AuthStatus = "loading" | "in" | "out";

let status: AuthStatus = "loading";
let started = false;
const subs = new Set<() => void>();

function setStatus(next: AuthStatus) {
  if (next === status) return;
  status = next;
  subs.forEach((f) => f());
}

function start() {
  if (started) return;
  started = true;
  void supabase.auth.getSession().then(({ data }) => setStatus(data.session ? "in" : "out"));
  supabase.auth.onAuthStateChange((_event, session) => setStatus(session ? "in" : "out"));
}

function subscribe(cb: () => void) {
  subs.add(cb);
  start();
  return () => {
    subs.delete(cb);
  };
}

export function useAuthStatus(): AuthStatus {
  return useSyncExternalStore(subscribe, () => status, () => "loading" as AuthStatus);
}

/** Resolves to an error message, or null on success. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? error.message : null;
}

export function signOut() {
  return supabase.auth.signOut();
}