import { useEffect, useRef } from "react";
import type { Stroke, StrokePoint } from "@/types/domain";

interface DrawingOverlayProps {
  strokes: Stroke[];
  isDrawingMode: boolean;
  onStroke: (points: StrokePoint[]) => void;
  width: number;
  height: number;
}

const INK =
  typeof getComputedStyle === "function"
    ? getComputedStyle(document.documentElement).getPropertyValue("--reader-ink").trim() || "#d9453f"
    : "#d9453f";

export default function DrawingOverlay({
  strokes,
  isDrawingMode,
  onStroke,
  width,
  height,
}: DrawingOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentPointsRef = useRef<StrokePoint[]>([]);
  const drawingRef = useRef(false);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawPath = (points: StrokePoint[], color: string, lineWidth: number) => {
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x * canvas.width, points[0].y * canvas.height);
      for (const p of points.slice(1)) {
        ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    };

    for (const stroke of strokes) drawPath(stroke.points, stroke.color, stroke.width);
    if (currentPointsRef.current.length >= 2) {
      drawPath(currentPointsRef.current, INK, 5);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
    redraw();
  }, [strokes, width, height]);

  function toNormalized(e: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.min(Math.max(x, 0), 1), y: Math.min(Math.max(y, 0), 1) };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingMode) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentPointsRef.current = [toNormalized(e)];
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingMode || !drawingRef.current) return;
    currentPointsRef.current.push(toNormalized(e));
    redraw();
  }

  function handlePointerUp() {
    if (!isDrawingMode || !drawingRef.current) return;
    drawingRef.current = false;
    if (currentPointsRef.current.length >= 2) {
      onStroke(currentPointsRef.current);
    }
    currentPointsRef.current = [];
    redraw();
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        touchAction: isDrawingMode ? "none" : "pan-x pan-y",
        cursor: isDrawingMode ? "crosshair" : "default",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}
