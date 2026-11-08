"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, ShieldCheck, X } from "lucide-react";
import { Brand } from "@/components/Brand";
import { addPhotos, getGuest, joinGuest, useAppState, type Guest } from "@/lib/store";
import { compress } from "@/lib/image";

const MAX_PHOTOS = 5;
const MAX_BYTES = 10 * 1024 * 1024;

type Draft = { src: string; caption: string };

export default function JoinPage() {
  const { state, ready } = useAppState();
  const [guest, setGuest] = useState<Guest | null>(() => (typeof window === "undefined" ? null : getGuest()));
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!ready) return <main className="flex-1" />;

  const nameOk = name.trim().length >= 2 && name.trim().length <= 24;

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    const room = MAX_PHOTOS - drafts.length;
    const next: Draft[] = [];
    for (const f of Array.from(files).slice(0, room)) {
      if (f.size > MAX_BYTES) {
        setError("Photos must be under 10 MB.");
        continue;
      }
      try {
        next.push({ src: await compress(f), caption: "" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't read that photo.");
      }
    }
    if (files.length > room) setError(`You can add up to ${MAX_PHOTOS} photos at a time.`);
    if (next.length) {
      setDrafts((d) => [...d, ...next]);
      setIdx(drafts.length);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function send() {
    if (!guest || !drafts.length) return;
    addPhotos(guest, drafts);
    setSent(drafts.length);
    setDrafts([]);
    setIdx(0);
  }

  const cur = drafts[idx];

  return (
    <main className="mx-auto flex w-full max-w-[430px] flex-1 flex-col px-5 pb-6 pt-6">
      <Brand size="lg" />
      <div className="mx-auto mt-3 h-px w-3/4 bg-gradient-to-r from-transparent via-brand to-transparent" />

      {!guest ? (
        <section className="anim-rise mt-8 flex flex-1 flex-col">
          <div className="text-center text-sm font-semibold text-brand2">You made it 🎉</div>
          <h1 className="mt-1 text-center text-4xl font-black leading-tight">What should we call you?</h1>
          <p className="mt-2 text-center text-sm text-white/60">Your name shows next to your photos on the big screen.</p>
          <form
            className="mt-8 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (nameOk) setGuest(joinGuest(name));
            }}
          >
            <label className="sr-only" htmlFor="name">Your display name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Your name"
              autoComplete="given-name"
              className="rounded-2xl border border-line bg-panel px-4 py-4 text-lg outline-none placeholder:text-white/30 focus:border-brand"
            />
            <button
              disabled={!nameOk}
              className="rounded-2xl bg-brand py-4 text-lg font-bold shadow-[0_0_24px_rgba(255,42,61,0.45)] transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              Join the party
            </button>
            <p className="text-center text-xs text-white/40">2–24 characters. No account, no password.</p>
          </form>
          <Consent className="mt-auto pt-8" />
        </section>
      ) : sent > 0 && !drafts.length ? (
        <section className="anim-rise mt-10 flex flex-1 flex-col items-center text-center">
          <div className="text-6xl">🎉</div>
          <h1 className="mt-4 text-3xl font-black">Uploaded! Watch the big screen.</h1>
          <p className="mt-2 text-white/60">
            {state.settings.instant ? "Main-character moment incoming." : "Your photo is in the queue."}
          </p>
          <button
            onClick={() => setSent(0)}
            className="mt-8 w-full rounded-2xl bg-brand py-4 text-lg font-bold shadow-[0_0_24px_rgba(255,42,61,0.45)] active:scale-[0.98]"
          >
            Drop another memory
          </button>
          <Consent className="mt-auto pt-8" />
        </section>
      ) : (
        <section className="mt-5 flex flex-1 flex-col">
          <div className="text-center text-sm font-semibold text-brand2">You made it 🎉</div>
          <h1 className="text-center text-4xl font-black">Drop a memory</h1>
          <p className="mt-1 text-center text-sm text-white/60">Your photos go straight to the big screen.</p>

          <div className="relative mt-4 aspect-[4/5] overflow-hidden rounded-3xl border border-brand/50 bg-panel shadow-[0_0_28px_rgba(255,42,61,0.2)]">
            {cur ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.src} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-2xl brightness-50" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.src} alt="Preview of your photo" className="absolute inset-0 size-full object-contain" />
                <button
                  aria-label="Remove this photo"
                  onClick={() => {
                    setDrafts((d) => d.filter((_, i) => i !== idx));
                    setIdx(0);
                  }}
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-black/60 backdrop-blur"
                >
                  <X className="size-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/50"
              >
                <ImageIcon className="size-14 text-brand" strokeWidth={1.4} />
                <span className="text-sm">Tap to pick a photo</span>
              </button>
            )}
          </div>

          {cur && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-panel px-3">
              <input
                value={cur.caption}
                onChange={(e) =>
                  setDrafts((d) => d.map((x, i) => (i === idx ? { ...x, caption: e.target.value } : x)))
                }
                maxLength={120}
                aria-label="Caption (optional)"
                placeholder="Add a caption (optional)"
                className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-white/35"
              />
              <span className="text-[10px] text-white/35">{cur.caption.length}/120</span>
            </div>
          )}

          <div className="mt-3 flex flex-col items-center gap-2">
            <div className="text-xs text-white/50">
              {drafts.length ? `${idx + 1} of ${drafts.length} photo${drafts.length > 1 ? "s" : ""}` : `Up to ${MAX_PHOTOS} photos`}
            </div>
            <div className="flex gap-2" role="tablist">
              {Array.from({ length: Math.max(drafts.length, 1) }).map((_, i) => (
                <button
                  key={i}
                  aria-label={`Photo ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`size-2 rounded-full ${i === idx ? "bg-brand" : "bg-white/25"}`}
                />
              ))}
            </div>
          </div>

          {error && <p role="alert" className="mt-2 text-center text-sm text-brand2">{error}</p>}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => pick(e.target.files)}
          />

          <div className="mt-4 flex flex-col gap-2">
            {drafts.length > 0 ? (
              <>
                <button
                  onClick={send}
                  className="rounded-2xl bg-brand py-4 text-lg font-bold shadow-[0_0_24px_rgba(255,42,61,0.45)] active:scale-[0.98]"
                >
                  Send {drafts.length > 1 ? `${drafts.length} photos` : "photo"} to the big screen
                </button>
                {drafts.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="rounded-2xl border border-line py-3 text-sm font-semibold text-white/80"
                  >
                    Add another
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-2xl bg-brand py-4 text-lg font-bold shadow-[0_0_24px_rgba(255,42,61,0.45)] active:scale-[0.98] disabled:opacity-60"
              >
                <ImageIcon className="size-5" /> {busy ? "Preparing…" : "Add a photo"}
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/50">
            <ShieldCheck className="size-3.5" /> No account needed · Public display
            {guest && <span className="text-white/30"> · Hi {guest.name}</span>}
          </div>
          <Consent className="mt-auto pt-4" />
        </section>
      )}
    </main>
  );
}

function Consent({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-snug text-white/40 ${className}`}>
      By uploading, you agree your photo may be shown on the party TV and saved by the hosts. Only share photos you have permission to share.
    </p>
  );
}
