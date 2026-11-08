"use client";

import { useMemo, useSyncExternalStore } from "react";

export type PhotoStatus = "live" | "pending" | "hidden";

export type Photo = {
  id: string;
  seq: number;
  name: string;
  caption: string;
  src: string;
  createdAt: number;
  status: PhotoStatus;
  guestId: string;
};

export type Settings = {
  instant: boolean;
  paused: boolean;
  showNames: boolean;
  showQr: boolean;
  spotlightSec: number;
  carouselSec: number;
  title: string;
  joinUrl: string;
};

export type AppState = {
  photos: Photo[];
  guests: string[];
  nextSeq: number;
  settings: Settings;
  replay: { id: string; nonce: number } | null;
};

export const DEFAULTS: AppState = {
  photos: [],
  guests: [],
  nextSeq: 1,
  replay: null,
  settings: {
    instant: true,
    paused: false,
    showNames: true,
    showQr: true,
    spotlightSec: 10,
    carouselSec: 10,
    title: "PUSHING 30",
    joinUrl: "",
  },
};

const KEY = "p30:state";
const SSR = "__ssr__";
const subs = new Set<() => void>();

function notify() {
  subs.forEach((f) => f());
}

function subscribe(cb: () => void) {
  subs.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function snapshot() {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

function parse(raw: string): AppState {
  if (!raw || raw === SSR) return DEFAULTS;
  try {
    const p = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULTS,
      ...p,
      settings: { ...DEFAULTS.settings, ...(p.settings ?? {}) },
    };
  } catch {
    return DEFAULTS;
  }
}

export function useAppState() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => SSR);
  const state = useMemo(() => parse(raw), [raw]);
  return { state, ready: raw !== SSR };
}

function write(next: AppState) {
  // localStorage is small (~5MB). If photos don't fit, drop the oldest until they do.
  const photos = [...next.photos];
  for (let i = 0; i <= photos.length; i++) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...next, photos }));
      break;
    } catch {
      if (photos.length === 0) break;
      photos.shift();
    }
  }
  notify();
}

export function update(fn: (s: AppState) => AppState) {
  write(fn(parse(snapshot())));
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ---------- guest identity (per browser) ----------
export type Guest = { id: string; name: string };
const GUEST_KEY = "p30:guest";

export function getGuest(): Guest | null {
  try {
    const g = localStorage.getItem(GUEST_KEY);
    return g ? (JSON.parse(g) as Guest) : null;
  } catch {
    return null;
  }
}

export function joinGuest(name: string): Guest {
  const guest = { id: uid(), name: name.trim() };
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  } catch {}
  update((s) => ({ ...s, guests: [...s.guests, guest.id] }));
  return guest;
}

// ---------- mutations ----------
export function addPhotos(
  guest: Guest,
  items: { src: string; caption: string }[],
) {
  update((s) => {
    let seq = s.nextSeq;
    const status: PhotoStatus = s.settings.instant ? "live" : "pending";
    const added = items.map((it) => ({
      id: uid(),
      seq: seq++,
      name: guest.name,
      caption: it.caption.trim(),
      src: it.src,
      createdAt: Date.now(),
      status,
      guestId: guest.id,
    }));
    return { ...s, nextSeq: seq, photos: [...s.photos, ...added] };
  });
}

export function setPhotoStatus(id: string, status: PhotoStatus) {
  update((s) => ({
    ...s,
    photos: s.photos.map((p) => (p.id === id ? { ...p, status } : p)),
  }));
}

export function removePhoto(id: string) {
  update((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) }));
}

export function clearPhotos() {
  update((s) => ({ ...s, photos: [] }));
}

export function patchSettings(patch: Partial<Settings>) {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function replayPhoto(id: string) {
  update((s) => ({ ...s, replay: { id, nonce: Date.now() } }));
}

// ---------- wall heartbeat (separate small key so admin can show it live) ----------
export type WallStatus = { hero: string | null; queue: number; at: number };
const WALL_KEY = "p30:wall";

export function publishWall(status: WallStatus) {
  try {
    localStorage.setItem(WALL_KEY, JSON.stringify(status));
  } catch {}
  window.dispatchEvent(new Event("p30:wall"));
}

function subscribeWall(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === WALL_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("p30:wall", cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("p30:wall", cb);
  };
}

function wallSnapshot() {
  try {
    return localStorage.getItem(WALL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function useWallStatus(): WallStatus | null {
  const raw = useSyncExternalStore(subscribeWall, wallSnapshot, () => "");
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as WallStatus) : null;
    } catch {
      return null;
    }
  }, [raw]);
}

export function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "Just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}
