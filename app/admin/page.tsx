"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Clock, Eye, EyeOff, Image as ImageIcon, Monitor, Pause, Play, QrCode, RotateCcw, Settings as Cog,
  Trash2, Users, Zap, Check, ChevronRight, Home, LogOut,
} from "lucide-react";
import { Brand, Toggle } from "@/components/Brand";
import { AdminGate } from "@/components/AdminGate";
import { signOut } from "@/lib/auth";
import {
  addPhotos, clearPhotos, patchSettings, removePhoto, replayPhoto, setPhotoStatus, timeAgo, useAppState,
  useWallStatus, type Photo,
} from "@/lib/store";
import { randomDemo } from "@/lib/image";

type Tab = "live" | "photos" | "settings";

function useNow(ms = 5000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [ms]);
  return now;
}

export default function AdminPage() {
  return (
    <AdminGate>
      <Dashboard />
    </AdminGate>
  );
}

function Dashboard() {
  const { state, ready } = useAppState();
  const wall = useWallStatus();
  const now = useNow();
  const [tab, setTab] = useState<Tab>("live");

  if (!ready) return <main className="flex-1" />;

  const { settings } = state;
  const photos = [...state.photos].sort((a, b) => b.seq - a.seq);
  const liveList = photos.filter((p) => p.status === "live");
  const connected = !!wall && now - wall.at < 12000;
  const onWall = (connected && wall?.hero ? photos.find((p) => p.id === wall.hero) : undefined) ?? liveList[0];
  const queued = connected ? wall?.queue ?? 0 : 0;
  const pending = photos.filter((p) => p.status === "pending").length;

  const nav: { id: Tab; label: string; icon: typeof Monitor }[] = [
    { id: "live", label: "Live wall", icon: Monitor },
    { id: "photos", label: "Photos", icon: ImageIcon },
    { id: "settings", label: "Settings", icon: Cog },
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-4 p-4 lg:flex-row lg:p-6">
      <aside className="flex shrink-0 items-center gap-3 lg:w-52 lg:flex-col lg:items-stretch lg:gap-6">
        <Link href="/" aria-label="Home" className="hidden py-2 lg:block"><Brand /></Link>
        <nav className="flex flex-1 gap-2 lg:flex-col" aria-label="Dashboard sections">
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => setTab(n.id)}
              aria-current={tab === n.id}
              className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition lg:flex-none ${
                tab === n.id ? "border-brand bg-brand/15 text-white glow-box" : "border-transparent text-white/60 hover:bg-panel2"
              }`}
            >
              <n.icon className="size-5" /> {n.label}
            </button>
          ))}
          <Link href="/" className="flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-white/60 hover:bg-panel2">
            <Home className="size-5" /> <span className="hidden sm:inline">Home</span>
          </Link>
          <button
            onClick={() => void signOut()}
            className="flex items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-white/60 hover:bg-panel2"
          >
            <LogOut className="size-5" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </nav>
        <div className="hidden text-center text-[10px] tracking-[0.25em] text-white/30 lg:block">
          GOOD PHOTOS<br />BETTER PEOPLE
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-[11px] font-semibold tracking-[0.3em] text-white/50">{settings.title}</div>
            <h1 className="flex items-center gap-3 text-3xl font-black sm:text-4xl">
              Tonight, live
              <span className="rounded-full border border-brand/70 px-3 py-0.5 text-xs font-bold glow-box">
                <span className="anim-pulse mr-1.5 inline-block size-2 rounded-full bg-brand" />LIVE
              </span>
            </h1>
          </div>
          <div className="text-right text-xs text-white/60">
            <span className={`mr-1.5 inline-block size-2 rounded-full ${connected ? "bg-green-500" : "bg-white/30"}`} />
            {connected ? "TV wall connected" : "TV wall not open"}
            <div className="italic text-white/35">Let the good times roll.</div>
          </div>
        </header>

        {tab === "live" && (
          <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            <Panel title="Now on the wall">
              {onWall ? (
                <>
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={onWall.src} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-50" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={onWall.src} alt="Currently on the wall" className="absolute inset-0 size-full object-contain" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Avatar name={onWall.name} />
                    <div className="mr-auto min-w-0">
                      <div className="truncate font-bold">{onWall.name}</div>
                      <div className="text-xs text-white/50">{timeAgo(onWall.createdAt, now)} from web</div>
                    </div>
                    <Btn icon={EyeOff} onClick={() => setPhotoStatus(onWall.id, "hidden")}>Hide photo</Btn>
                    <Btn danger icon={Trash2} onClick={() => removePhoto(onWall.id)}>Remove</Btn>
                  </div>
                </>
              ) : (
                <Empty>No photos yet. Share the QR code and watch this fill up.</Empty>
              )}
            </Panel>

            <div className="flex flex-col gap-3">
              <Row hot icon={Zap} title="Instant display" body="New uploads appear on the TV right away.">
                <Toggle label="Instant display" on={settings.instant} onChange={(v) => patchSettings({ instant: v })} />
              </Row>
              <Row icon={settings.paused ? Play : Pause} title="Pause new photos" body="Temporarily stop showing new uploads.">
                <Toggle label="Pause new photos" on={settings.paused} onChange={(v) => patchSettings({ paused: v })} />
              </Row>
              <Row icon={Users} title="Show guest names" body="Display uploader names on the TV wall.">
                <Toggle label="Show guest names" on={settings.showNames} onChange={(v) => patchSettings({ showNames: v })} />
              </Row>
              <Row icon={Clock} title="Spotlight duration" body="How long each photo stays on screen.">
                <Select value={settings.spotlightSec} onChange={(v) => patchSettings({ spotlightSec: v })} options={[5, 8, 10, 12, 15, 20]} />
              </Row>
              <Link
                href="/wall"
                className="flex items-center justify-between rounded-2xl bg-brand px-5 py-4 text-lg font-bold shadow-[0_0_28px_rgba(255,42,61,0.45)] transition active:scale-[0.99]"
              >
                <span className="flex items-center gap-3"><Monitor className="size-6" /> See on TV</span>
                <ChevronRight />
              </Link>
              <div className="grid grid-cols-3 gap-3">
                <Stat icon={ImageIcon} n={state.photos.length} label="photos shared" />
                <Stat icon={Users} n={state.guestCount} label="guests joined" />
                <Stat icon={Clock} n={queued + pending} label="in queue" />
              </div>
            </div>

            <div className="xl:col-span-2">
              <Panel
                title="Recent uploads"
                action={<button className="text-xs text-white/60 hover:text-white" onClick={() => setTab("photos")}>View all photos →</button>}
              >
                {photos.length ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {photos.slice(0, 7).map((p) => <Thumb key={p.id} p={p} />)}
                  </div>
                ) : (
                  <Empty>Nothing uploaded yet.</Empty>
                )}
              </Panel>
            </div>
          </div>
        )}

        {tab === "photos" && (
          <Panel title={`All photos (${photos.length})`}>
            {photos.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {photos.map((p) => <PhotoCard key={p.id} p={p} now={now} />)}
              </div>
            ) : (
              <Empty>No photos yet.</Empty>
            )}
          </Panel>
        )}

        {tab === "settings" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Wall">
              <div className="flex flex-col gap-4">
                <Field label="Event title">
                  <CommitInput
                    value={settings.title}
                    onCommit={(v) => patchSettings({ title: v })}
                    className="w-full rounded-xl border border-line bg-panel2 px-3 py-2.5 outline-none focus:border-brand"
                  />
                </Field>
                <Field label="Join link shown in the QR code" hint="Leave blank to use this site's /join. When you deploy or use your laptop's Wi-Fi address, put it here so phones can reach it.">
                  <CommitInput
                    value={settings.joinUrl}
                    onCommit={(v) => patchSettings({ joinUrl: v })}
                    placeholder="https://your-site.example/join"
                    className="w-full rounded-xl border border-line bg-panel2 px-3 py-2.5 outline-none placeholder:text-white/25 focus:border-brand"
                  />
                </Field>
                <Row icon={QrCode} title="Show QR on wall" body="Corner QR while photos play.">
                  <Toggle label="Show QR on wall" on={settings.showQr} onChange={(v) => patchSettings({ showQr: v })} />
                </Row>
                <Row icon={Clock} title="Carousel speed" body="Seconds per gallery photo.">
                  <Select value={settings.carouselSec} onChange={(v) => patchSettings({ carouselSec: v })} options={[5, 6, 7, 8, 10]} />
                </Row>
              </div>
            </Panel>
            <Panel title="Testing">
              <p className="mb-3 text-sm text-white/60">Handy for checking the wall without a party full of phones.</p>
              <div className="flex flex-wrap gap-2">
                <Btn icon={Zap} onClick={async () => {
                  const d = await randomDemo(Math.floor(Math.random() * 1000));
                  await addPhotos({ id: "demo", name: d.name }, [{ blob: d.blob, caption: d.caption }]);
                }}>Send test photo</Btn>
                <Btn icon={Zap} onClick={async () => {
                  const base = Math.floor(Math.random() * 1000);
                  for (let i = 0; i < 5; i++) {
                    const d = await randomDemo(base + i);
                    await addPhotos({ id: "demo", name: d.name }, [{ blob: d.blob, caption: d.caption }]);
                  }
                }}>Send burst of 5</Btn>
                <Btn danger icon={Trash2} onClick={() => confirm("Delete ALL photos?") && clearPhotos()}>Clear all photos</Btn>
              </div>
              <p className="mt-4 text-xs text-white/40">
                Photos are stored in Supabase. Test photos use the guest name shown on the wall and count toward your storage.
              </p>
            </Panel>
          </div>
        )}
      </section>
    </main>
  );
}

// Text field that only saves when you click away or press Enter, so typing doesn't
// fire a database write (and a realtime echo) on every keystroke.
function CommitInput({
  value,
  onCommit,
  ...props
}: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      {...props}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft);
        setDraft(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-line bg-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-bold tracking-[0.25em] text-white/70">{title.toUpperCase()}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ icon: Icon, title, body, hot, children }: { icon: typeof Zap; title: string; body: string; hot?: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border bg-panel px-4 py-3 ${hot ? "border-brand glow-box" : "border-line"}`}>
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand"><Icon className="size-5" /></div>
      <div className="mr-auto min-w-0">
        <div className="font-bold">{title}</div>
        <div className="text-xs text-white/50">{body}</div>
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: number[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-xl border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-brand"
    >
      {options.map((o) => <option key={o} value={o}>{o} seconds</option>)}
    </select>
  );
}

function Stat({ icon: Icon, n, label }: { icon: typeof Zap; n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-3">
      <Icon className="size-6 shrink-0 text-brand" />
      <div>
        <div className="text-2xl font-black leading-none">{n}</div>
        <div className="mt-1 text-[11px] text-white/50">{label}</div>
      </div>
    </div>
  );
}

function Btn({ icon: Icon, danger, onClick, children }: { icon: typeof Zap; danger?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
        danger ? "border-brand bg-brand/15 text-brand2 hover:bg-brand/25" : "border-line bg-panel2 text-white/90 hover:border-white/30"
      }`}
    >
      <Icon className="size-4" /> {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-white/40">{hint}</span>}
    </label>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-white/40">{children}</div>;
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-brand to-brand2 text-sm font-black">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Thumb({ p }: { p: Photo }) {
  const hidden = p.status === "hidden";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt={`Photo by ${p.name}`} className={`size-full object-cover ${hidden ? "opacity-30" : ""}`} />
      </div>
      <button
        onClick={() => setPhotoStatus(p.id, hidden ? "live" : "hidden")}
        className="flex items-center justify-center gap-1.5 rounded-lg bg-panel2 py-1.5 text-xs font-semibold text-white/80 hover:text-white"
      >
        {hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />} {hidden ? "Show" : "Hide"}
      </button>
    </div>
  );
}

function PhotoCard({ p, now }: { p: Photo; now: number }) {
  const label = p.status === "live" ? "Live" : p.status === "pending" ? "Waiting" : "Hidden";
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel2">
      <div className="relative aspect-[4/3] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt={`Photo by ${p.name}`} className={`size-full object-cover ${p.status === "hidden" ? "opacity-30" : ""}`} />
        <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.status === "live" ? "bg-brand" : "bg-black/70 text-white/70"}`}>{label}</span>
      </div>
      <div className="p-2.5">
        <div className="truncate text-sm font-bold">{p.name}</div>
        <div className="truncate text-xs text-white/50">{p.caption || "No caption"} · {timeAgo(p.createdAt, now)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {p.status === "pending" && <Mini onClick={() => setPhotoStatus(p.id, "live")} icon={Check} label="Approve" />}
          {p.status === "live" && <Mini onClick={() => replayPhoto(p.id)} icon={RotateCcw} label="Replay" />}
          {p.status !== "pending" && (
            <Mini
              onClick={() => setPhotoStatus(p.id, p.status === "hidden" ? "live" : "hidden")}
              icon={p.status === "hidden" ? Eye : EyeOff}
              label={p.status === "hidden" ? "Show" : "Hide"}
            />
          )}
          <Mini danger onClick={() => removePhoto(p.id)} icon={Trash2} label="Remove" />
        </div>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, onClick, danger }: { icon: typeof Zap; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ${danger ? "bg-brand/15 text-brand2" : "bg-panel text-white/80 hover:text-white"}`}
    >
      <Icon className="size-3" /> {label}
    </button>
  );
}