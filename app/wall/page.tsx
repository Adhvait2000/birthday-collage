/* eslint-disable react-hooks/set-state-in-effect -- wall is a timer-driven state machine over an external store */
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Maximize } from "lucide-react";
import { publishWall, useAppState, type Photo } from "@/lib/store";

function Crossfade({ k, children }: { k: string; children: ReactNode }) {
  const [layers, setLayers] = useState<{ k: string; node: ReactNode; out: boolean }[]>([
    { k, node: children, out: false },
  ]);
  useEffect(() => {
    setLayers((prev) =>
      prev.some((l) => l.k === k && !l.out)
        ? prev.map((l) => (l.k === k ? { ...l, node: children } : l))
        : [...prev.map((l) => ({ ...l, out: true })), { k, node: children, out: false }],
    );
    const t = setTimeout(() => setLayers((p) => p.filter((l) => !l.out)), 700);
    return () => clearTimeout(t);
  }, [k, children]);
  return (
    <>
      {layers.map((l, i) => (
        <div key={`${l.k}-${i}`} className={`absolute inset-0 ${l.out ? "anim-fade-out" : "anim-fade-in"}`}>
          {l.node}
        </div>
      ))}
    </>
  );
}

function PhotoSlide({ photo, hero, showName, spot }: { photo: Photo; hero: boolean; showName: boolean; spot: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.src} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-3xl brightness-50" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.src}
        alt={photo.caption || `Photo by ${photo.name}`}
        className={`absolute inset-0 size-full object-contain ${hero ? "anim-kenburns" : ""}`}
        style={hero ? { animationDuration: `${spot + 2}s` } : undefined}
      />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 to-transparent" />
      {(showName || photo.caption) && (
        <div className="anim-rise absolute bottom-[3vw] left-[3vw] max-w-[60%]">
          {showName && (
            <div className="text-[1.2vw] font-medium text-white/80">
              {hero ? (
                <>
                  Just dropped by <span className="font-bold text-brand2">{photo.name}</span>
                </>
              ) : (
                <>📸 {photo.name}</>
              )}
            </div>
          )}
          {photo.caption && (
            <div className="mt-[0.4vw] text-[2.4vw] font-extrabold leading-tight">{photo.caption}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WallPage() {
  const { state, ready } = useAppState();
  const { settings } = state;
  const router = useRouter();

  const live = useMemo(
    () => state.photos.filter((p) => p.status === "live").sort((a, b) => a.seq - b.seq),
    [state.photos],
  );
  const byId = useMemo(() => new Map(live.map((p) => [p.id, p])), [live]);

  const [queue, setQueue] = useState<string[]>([]);
  const [hero, setHero] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const lastSeq = useRef<number | null>(null);
  const seenReplay = useRef<number | null>(null);

  // Enqueue newly arrived photos (FIFO). On first load, mark everything existing as already seen.
  useEffect(() => {
    if (!ready) return;
    if (lastSeq.current === null) {
      lastSeq.current = Math.max(0, ...state.photos.map((p) => p.seq));
      seenReplay.current = state.replay?.nonce ?? 0;
      return;
    }
    if (settings.paused) return;
    const fresh = live.filter((p) => p.seq > (lastSeq.current ?? 0));
    if (fresh.length) {
      lastSeq.current = Math.max(...fresh.map((p) => p.seq));
      setQueue((q) => [...q, ...fresh.map((p) => p.id)]);
    }
  }, [ready, live, state.photos, state.replay, settings.paused]);

  // Host "replay" jumps to the front of the line.
  useEffect(() => {
    const r = state.replay;
    if (!ready || !r || seenReplay.current === null || r.nonce === seenReplay.current) return;
    seenReplay.current = r.nonce;
    setQueue((q) => [r.id, ...q.filter((x) => x !== r.id)]);
  }, [ready, state.replay]);

  // Drop hidden/removed photos from the queue and the hero slot right away.
  useEffect(() => {
    setQueue((q) => (q.every((id) => byId.has(id)) ? q : q.filter((id) => byId.has(id))));
    setHero((h) => (h && !byId.has(h) ? null : h));
  }, [byId]);

  // Pull the next hero when idle.
  useEffect(() => {
    if (!hero && queue.length && !settings.paused) {
      setHero(queue[0]);
      setQueue((q) => q.slice(1));
    }
  }, [hero, queue, settings.paused]);

  useEffect(() => {
    if (!hero) return;
    const t = setTimeout(() => setHero(null), settings.spotlightSec * 1000);
    return () => clearTimeout(t);
  }, [hero, settings.spotlightSec]);

  useEffect(() => {
    if (hero) return;
    const t = setInterval(() => setTick((i) => i + 1), settings.carouselSec * 1000);
    return () => clearInterval(t);
  }, [hero, settings.carouselSec]);

  // Heartbeat so the admin dashboard knows the TV is connected.
  useEffect(() => {
    if (!ready) return;
    const send = () => publishWall({ hero, queue: queue.length, at: Date.now() });
    send();
    const t = setInterval(send, 4000);
    return () => clearInterval(t);
  }, [ready, hero, queue.length]);

  const [full, setFull] = useState(false);
  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") toggleFull();
      if (e.key === "a" || e.key === "A") router.push("/admin");
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [router]);
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (!ready) return <main className="fixed inset-0 bg-ink" />;

  const heroPhoto = hero ? byId.get(hero) : undefined;
  const carouselPhoto = live.length ? live[tick % live.length] : undefined;
  const shown = heroPhoto ?? carouselPhoto;
  const joinUrl = settings.joinUrl || `${window.location.origin}/join`;
  const joinHost = joinUrl.replace(/^https?:\/\//, "");

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink p-[1.2vw] cursor-none hover:cursor-default">
      <div className={`relative h-full w-full overflow-hidden rounded-[2vw] border border-brand/40 ${heroPhoto ? "glow-box" : ""}`}>
        {shown ? (
          <Crossfade k={`${heroPhoto ? "h" : "c"}:${shown.id}`}>
            <PhotoSlide photo={shown} hero={!!heroPhoto} showName={settings.showNames} spot={settings.spotlightSec} />
          </Crossfade>
        ) : (
          <Idle title={settings.title} joinUrl={joinUrl} joinHost={joinHost} />
        )}

        {/* Chrome */}
        <div className="pointer-events-none absolute left-[2.5vw] top-[2vw]">
          <div className="text-[2.6vw] font-black leading-none tracking-[0.06em] glow-text">{settings.title}</div>
          <div className="mt-[0.4vw] text-[1vw] tracking-[0.4em] text-white/80">PHOTO WALL</div>
          <div className="mt-[0.6vw] h-[2px] w-[3vw] bg-brand" />
        </div>

        <div className="pointer-events-none absolute right-[2vw] top-[2vw] flex items-center gap-[0.6vw] rounded-full border border-brand/60 bg-black/50 px-[1.2vw] py-[0.5vw] text-[1vw] font-bold backdrop-blur">
          <span className="anim-pulse size-[0.7vw] rounded-full bg-brand" /> LIVE
        </div>

        {queue.length > 0 && (
          <div className="anim-rise pointer-events-none absolute right-[2vw] top-1/2 -translate-y-1/2 text-right text-[1.2vw] font-semibold">
            <div className="mb-[0.5vw] flex justify-end gap-[0.4vw]">
              {Array.from({ length: Math.min(queue.length, 5) }).map((_, i) => (
                <span key={i} className="size-[0.55vw] rounded-full bg-brand" />
              ))}
            </div>
            {queue.length} photo{queue.length > 1 ? "s" : ""}
            <br />
            coming up
          </div>
        )}

        {settings.showQr && shown && (
          <div className="pointer-events-none absolute bottom-[2vw] right-[2vw] rounded-[1vw] border border-brand/60 bg-black/70 p-[0.8vw] text-center backdrop-blur">
            <div className="rounded-[0.5vw] bg-white p-[0.5vw]">
              <QRCodeSVG value={joinUrl} style={{ width: "7vw", height: "7vw" }} />
            </div>
            <div className="mt-[0.5vw] text-[0.75vw] font-semibold text-white/80">Scan · Join · Upload</div>
            <div className="max-w-[8.5vw] truncate text-[0.7vw] text-brand2">{joinHost}</div>
          </div>
        )}

        {settings.paused && (
          <div className="absolute bottom-[2vw] left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-[1.2vw] py-[0.4vw] text-[0.9vw] text-white/70">
            New photos paused
          </div>
        )}
      </div>

      <div className="absolute left-1/2 top-3 flex -translate-x-1/2 gap-2 opacity-0 transition hover:opacity-100 focus-within:opacity-100">
        <Link href="/admin" className="rounded-full bg-black/70 px-4 py-2 text-sm">
          <ArrowLeft className="mr-2 inline size-4" />
          Back to dashboard (A)
        </Link>
        <button
          onClick={toggleFull}
          aria-label={full ? "Exit full screen" : "Enter full screen"}
          className="rounded-full bg-black/70 px-4 py-2 text-sm"
        >
          <Maximize className="mr-2 inline size-4" />
          {full ? "Exit full screen" : "Full screen (F)"}
        </button>
      </div>
    </main>
  );
}

function Idle({ title, joinUrl, joinHost }: { title: string; joinUrl: string; joinHost: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden">
      <div className="anim-drift absolute -left-[10%] top-[10%] size-[45vw] rounded-full bg-brand/20 blur-[10vw]" />
      <div className="anim-drift absolute -bottom-[10%] right-[0%] size-[40vw] rounded-full bg-brand2/15 blur-[10vw]" style={{ animationDelay: "-6s" }} />
      <div className="relative flex flex-col items-center text-center">
        <h1 className="text-[9vw] font-black leading-none tracking-[0.04em] glow-text">{title}</h1>
        <div className="mt-[0.8vw] text-[2vw] tracking-[0.5em] text-white/80">PHOTO WALL</div>
        <div className="mt-[3vw] rounded-[1.5vw] bg-white p-[1vw] shadow-[0_0_60px_rgba(255,42,61,0.4)]">
          <QRCodeSVG value={joinUrl} style={{ width: "14vw", height: "14vw" }} />
        </div>
        <div className="mt-[1.5vw] text-[2vw] font-bold">Scan • Join • Upload</div>
        <div className="mt-[0.4vw] text-[1.3vw] text-brand2">{joinHost}</div>
      </div>
    </div>
  );
}
