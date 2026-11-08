import { Camera } from "lucide-react";

export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <div className="flex flex-col items-center text-center">
      <Camera className={`${lg ? "size-9" : "size-7"} text-brand drop-shadow-[0_0_10px_rgba(255,42,61,0.8)]`} strokeWidth={1.6} />
      <div className={`${lg ? "text-2xl" : "text-lg"} mt-1 font-black tracking-[0.12em] leading-none glow-text`}>
        PUSHING 30
      </div>
      <div className="mt-1 text-[10px] tracking-[0.35em] text-white/70">PHOTO WALL</div>
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-[74px] shrink-0 rounded-full border text-[11px] font-bold transition-colors ${
        on ? "border-brand bg-brand text-white" : "border-line bg-panel2 text-white/60"
      }`}
    >
      <span className={`absolute top-1/2 -translate-y-1/2 ${on ? "left-3" : "right-3"}`}>{on ? "ON" : "OFF"}</span>
      <span
        className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? "left-[44px]" : "left-1"}`}
      />
    </button>
  );
}
