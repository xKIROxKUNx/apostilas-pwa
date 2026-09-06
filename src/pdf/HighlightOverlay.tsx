import { useEffect, useRef } from "react";
import type { HighlightRect } from "./pdfTextIndex";

function token(nome: string, fallback: string): string {
  if (typeof getComputedStyle !== "function") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return v || fallback;
}

const HIGHLIGHT_FILL = token("--reader-highlight", "rgb(255 235 59 / 0.38)");
const CURRENT_FILL = token("--reader-highlight-current", "rgb(255 167 38 / 0.55)");

interface HighlightOverlayProps {
  occurrences: HighlightRect[][];
  currentOrdinal: number | null;
  width: number;
  height: number;
}

export default function HighlightOverlay({
  occurrences,
  currentOrdinal,
  width,
  height,
}: HighlightOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    occurrences.forEach((rects, ordinal) => {
      ctx.fillStyle = ordinal === currentOrdinal ? CURRENT_FILL : HIGHLIGHT_FILL;
      for (const r of rects) {
        ctx.fillRect(
          r.left * canvas.width,
          r.top * canvas.height,
          (r.right - r.left) * canvas.width,
          (r.bottom - r.top) * canvas.height,
        );
      }
    });
  }, [occurrences, currentOrdinal, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
