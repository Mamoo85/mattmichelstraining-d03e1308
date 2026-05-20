import { useEffect, useRef } from "react";

interface Props {
  image: string;
  text: string;
  fontFamily: string;
  tint?: string;
}

export default function LivePreviewCanvas({ image, text, fontFamily, tint }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 800;
    const H = 800;
    canvas.width = W;
    canvas.height = H;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      if (tint) {
        ctx.fillStyle = tint;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      if (text.trim()) {
        const pad = 60;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(pad, H / 2 - 70, W - pad * 2, 140);
        ctx.fillStyle = "#f5f0e8";
        const fontSize = Math.max(36, Math.min(96, 800 / Math.max(text.length, 4)));
        ctx.font = `600 ${fontSize}px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, W / 2, H / 2);
      }
    };
    img.onerror = () => {
      ctx.fillStyle = "#ebe3d5";
      ctx.fillRect(0, 0, W, H);
    };
    img.src = image;
  }, [image, text, fontFamily, tint]);

  return <canvas ref={ref} className="h-full w-full object-cover" data-testid="gg-preview-canvas" aria-label="Live customization preview" />;
}

export function exportCanvas(canvasEl: HTMLCanvasElement | null): string | undefined {
  if (!canvasEl) return undefined;
  try { return canvasEl.toDataURL("image/jpeg", 0.7); } catch { return undefined; }
}
