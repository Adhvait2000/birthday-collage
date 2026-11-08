"use client";

import { useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, BUCKET } from "@/lib/supabase";

// ---------- types ----------
export type PhotoStatus = "live" | "pending" | "hidden";

export type Photo = {
  id: string;
  seq: number;
  name: string;
  caption: string;
  src: string; // public URL of the image in Supabase Storage
  path: string; // file path inside the bucket
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
  guestCount: number; // only populated for the logged-in host
  settings: Settings;
  replay: { id: string; nonce: number } | null;
};

export const DEFAULTS: AppState = {
  photos: [],
  guestCount: 0,
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

// ---------- database rows <-> app types ----------
type PhotoRow = {
  id: string;
  seq: number;
  name: string;
  caption: string;
  path: string;
  status: PhotoStatus;
  guest_id: string;
  created_at: string;
};

type SettingsRow = {
  instant: boolean;
  paused: boolean;
  show_names: boolean;
  show_qr: boolean;
  spotlight_sec: number;
  carousel_sec: number;
  title: string;
  join_url: string;
  replay_id: string | null;
  replay_nonce: number;
};

const SETTINGS_COLUMNS: Record<keyof Settings, string> = {
  instant: "instant",
  paused: "paused",
  showNames: "show_names",
  showQr: "show_qr",
  spotlightSec: "spotlight_sec",
  carouselSec: "carousel_sec",
  title: "title",
  joinUrl: "join_url",
};

const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

function toPhoto(r: PhotoRow): Photo {
  return {
    id: r.id,
    seq: Number(r.seq),
    name: r.name,
    caption: r.caption,
    src: publicUrl(r.path),
    path: r.path,
    createdAt: Date.parse(r.created_at),
    status: r.status,
    guestId: r.guest_id,
  };
}

function toSettings(r: SettingsRow): Pick<AppState, "settings" | "replay"> {
  return {
    settings: {
      instant: r.instant,
      paused: r.paused,
      showNames: r.show_names,
      showQr: r.show_qr,
      spotlightSec: r.spotlight_sec,
      carouselSec: r.carousel_sec,
      title: r.title,
      joinUrl: r.join_url,
    },
    replay: r.replay_id ? { id: r.replay_id, nonce: Number(r.replay_nonce) } : null,
  };
}

// Warm the browser cache so a new photo doesn't pop in half-loaded on the TV.
function preload(p: Photo) {
  if (p.status !== "live" || typeof Image === "undefined") return;
  new Image().src = p.src;
}

// ---------- store core ----------
type Snapshot = { state: AppState; ready: boolean };

const SERVER_SNAPSHOT: Snapshot = { state: DEFAULTS, ready: false };
let snap: Snapshot = SERVER_SNAPSHOT;
const subs = new Set<() => void>();

function commit(patch: Partial<AppState>, ready = snap.ready) {
  snap = { state: { ...snap.state, ...patch }, ready };
  subs.forEach((f) => f());
}

async function loadAll() {
  const [p, s] = await Promise.all([
    supabase.from("photos").select("*").order("seq", { ascending: true }),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);
  if (p.error || s.error) {
    console.error("[store] load failed:", p.error?.message ?? s.error?.message);
    return;
  }
  const known = new Set(snap.state.photos.map((x) => x.id));
  const photos = (p.data as PhotoRow[]).map(toPhoto);
  if (snap.ready) photos.filter((x) => !known.has(x.id)).forEach(preload);
  commit({ photos, ...toSettings(s.data as SettingsRow) }, true);
}

async function loadGuestCount() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return; // anon users can't read the guests table
  const { count, error } = await supabase.from("guests").select("id", { count: "exact", head: true });
  if (!error && count !== null) commit({ guestCount: count });
}

let channel: RealtimeChannel | null = null;
let poll: ReturnType<typeof setInterval> | undefined;
let authSub: { unsubscribe: () => void } | undefined;

function start() {
  void loadAll();
  void loadGuestCount();

  // Unique name so a quick stop/start (React StrictMode in dev) never reuses a closing channel.
  channel = supabase
    .channel(`p30-db-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "photos" }, (payload) => {
      if (payload.eventType === "DELETE") {
        const id = (payload.old as { id?: string }).id;
        if (id) commit({ photos: snap.state.photos.filter((p) => p.id !== id) });
        return;
      }
      const photo = toPhoto(payload.new as PhotoRow);
      preload(photo);
      const rest = snap.state.photos.filter((p) => p.id !== photo.id);
      commit({ photos: [...rest, photo].sort((a, b) => a.seq - b.seq) });
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings" }, (payload) => {
      commit(toSettings(payload.new as SettingsRow));
    })
    .subscribe((status) => {
      // (Re)connected: re-sync in case we missed events while offline.
      if (status === "SUBSCRIBED") void loadAll();
    });

  // Safety net for flaky venue Wi-Fi: full refresh every 30s.
  poll = setInterval(() => {
    void loadAll();
    void loadGuestCount();
  }, 30_000);

  // Don't call supabase from inside the auth callback directly (can deadlock) — defer.
  authSub = supabase.auth.onAuthStateChange(() => {
    setTimeout(() => void loadGuestCount(), 0);
  }).data.subscription;
}

function stop() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  clearInterval(poll);
  authSub?.unsubscribe();
  authSub = undefined;
}

function subscribe(cb: () => void) {
  subs.add(cb);
  if (subs.size === 1) start();
  return () => {
    subs.delete(cb);
    if (subs.size === 0) stop();
  };
}

export function useAppState() {
  const s = useSyncExternalStore(subscribe, () => snap, () => SERVER_SNAPSHOT);
  return { state: s.state, ready: s.ready };
}

// Runs a write; on failure logs it and re-syncs from the server so the UI never lies.
async function run(label: string, op: () => PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await op();
  if (error) {
    console.error(`[store] ${label} failed:`, error.message);
    void loadAll();
    return false;
  }
  return true;
}

// Math.random (not crypto.randomUUID) on purpose: randomUUID needs https, but a phone on the
// venue Wi-Fi may be loading http://192.168.x.x during testing.
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

export async function joinGuest(name: string): Promise<Guest> {
  const guest = { id: uid(), name: name.trim() };
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
  } catch {}
  // Only used for the host's "guests joined" counter, so a failure here must not block the guest.
  const { error } = await supabase.from("guests").insert({ id: guest.id, name: guest.name });
  if (error) console.error("[store] join failed:", error.message);
  return guest;
}

// ---------- mutations ----------
/** Uploads one at a time (keeps order, gentle on phone data). Never throws. */
export async function addPhotos(
  guest: Guest,
  items: { blob: Blob; caption: string }[],
): Promise<{ sent: number; error?: string }> {
  let sent = 0;
  for (const it of items) {
    const path = `${uid()}.jpg`;
    const up = await supabase.storage
      .from(BUCKET)
      .upload(path, it.blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (up.error) return { sent, error: `Upload failed: ${up.error.message}` };

    const ins = await supabase
      .from("photos")
      .insert({ name: guest.name, caption: it.caption.trim(), path, guest_id: guest.id });
    if (ins.error) {
      await supabase.storage.from(BUCKET).remove([path]); // don't leave an orphan file
      return { sent, error: `Couldn't save photo: ${ins.error.message}` };
    }
    sent++;
  }
  return { sent };
}

export async function setPhotoStatus(id: string, status: PhotoStatus) {
  commit({ photos: snap.state.photos.map((p) => (p.id === id ? { ...p, status } : p)) });
  await run("set status", () => supabase.from("photos").update({ status }).eq("id", id));
}

export async function removePhoto(id: string) {
  const photo = snap.state.photos.find((p) => p.id === id);
  commit({ photos: snap.state.photos.filter((p) => p.id !== id) });
  const ok = await run("remove photo", () => supabase.from("photos").delete().eq("id", id));
  if (ok && photo) await supabase.storage.from(BUCKET).remove([photo.path]);
}

export async function clearPhotos() {
  const paths = snap.state.photos.map((p) => p.path);
  commit({ photos: [] });
  const ok = await run("clear photos", () => supabase.from("photos").delete().not("id", "is", null));
  if (!ok) return;
  for (let i = 0; i < paths.length; i += 100) {
    await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
  }
}

export async function patchSettings(patch: Partial<Settings>) {
  commit({ settings: { ...snap.state.settings, ...patch } });
  const row = Object.fromEntries(
    Object.entries(patch).map(([k, v]) => [SETTINGS_COLUMNS[k as keyof Settings], v]),
  );
  await run("update settings", () => supabase.from("settings").update(row).eq("id", 1));
}

export async function replayPhoto(id: string) {
  const nonce = Date.now();
  commit({ replay: { id, nonce } });
  await run("replay", () =>
    supabase.from("settings").update({ replay_id: id, replay_nonce: nonce }).eq("id", 1),
  );
}

// ---------- wall heartbeat (TV -> host dashboard, across devices via Realtime broadcast) ----------
export type WallStatus = { hero: string | null; queue: number; at: number };

let wallChannel: RealtimeChannel | null = null;
let wallReady = false;
let wallLast: WallStatus | null = null;
const wallSubs = new Set<() => void>();

function ensureWallChannel() {
  if (wallChannel) return;
  wallChannel = supabase
    .channel("p30-wall", { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "status" }, ({ payload }) => {
      // Stamp with OUR clock: the TV's clock may differ from the host's device.
      wallLast = { ...(payload as WallStatus), at: Date.now() };
      wallSubs.forEach((f) => f());
    })
    .subscribe((status) => {
      wallReady = status === "SUBSCRIBED";
    });
}

export function publishWall(status: WallStatus) {
  ensureWallChannel();
  if (wallReady) void wallChannel?.send({ type: "broadcast", event: "status", payload: status });
}

function subscribeWall(cb: () => void) {
  wallSubs.add(cb);
  ensureWallChannel();
  return () => {
    wallSubs.delete(cb);
  };
}

export function useWallStatus(): WallStatus | null {
  return useSyncExternalStore(subscribeWall, () => wallLast, () => null);
}

export function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "Just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}