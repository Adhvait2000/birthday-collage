// Resize + re-encode in a canvas. This also strips EXIF/location metadata.
export async function compress(file: File, max = 1100, quality = 0.72): Promise<string> {
  let source: CanvasImageSource & { width: number; height: number };
  let close: (() => void) | undefined;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    source = bmp;
    close = () => bmp.close();
  } catch {
    const url = URL.createObjectURL(file);
    try {
      source = await new Promise<HTMLImageElement>((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => rej(new Error("This photo format isn't supported on your browser."));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const c = document.createElement("canvas");
  c.width = Math.round(source.width * scale);
  c.height = Math.round(source.height * scale);
  c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
  close?.();
  return c.toDataURL("image/jpeg", quality);
}

const EMOJI = ["🪩", "🎉", "🥂", "💃", "🕺", "📸", "🎂", "🔥", "✨", "🎶"];
const NAMES = ["Maya", "Dev", "Priya", "Sam", "Jo", "Arjun", "Lena", "Kai"];
const LINES = [
  "Best night with my favorite people ✨",
  "Pushing 30 like a pro",
  "Main-character moment",
  "",
  "Cake time!",
  "",
];

export function randomDemo(i: number) {
  const portrait = i % 3 === 0;
  const w = portrait ? 800 : 1200;
  const h = portrait ? 1050 : 800;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const hue = [350, 340, 10, 320, 0][i % 5];
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${hue} 85% 22%)`);
  grad.addColorStop(1, `hsl(${hue + 30} 70% 8%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  for (let k = 0; k < 28; k++) {
    g.beginPath();
    g.fillStyle = `hsla(${hue + Math.random() * 40} 100% 65% / ${0.08 + Math.random() * 0.2})`;
    g.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 120, 0, Math.PI * 2);
    g.fill();
  }
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `${Math.round(h * 0.38)}px sans-serif`;
  g.fillText(EMOJI[i % EMOJI.length], w / 2, h * 0.45);
  g.fillStyle = "#fff";
  g.font = `bold ${Math.round(h * 0.07)}px sans-serif`;
  g.fillText("PUSHING 30", w / 2, h * 0.82);
  return {
    src: c.toDataURL("image/jpeg", 0.7),
    name: NAMES[i % NAMES.length],
    caption: LINES[i % LINES.length],
  };
}
