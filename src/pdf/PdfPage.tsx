import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { Stroke, StrokePoint } from "@/types/domain";
import { computeRenderScale, RERENDER_TOLERANCE } from "./renderScale";
import { drawWatermark } from "@/security/watermark";
import DrawingOverlay from "./DrawingOverlay";
import HighlightOverlay from "./HighlightOverlay";
import type { HighlightRect } from "./pdfTextIndex";

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageIndex: number;
  aspectRatio: number;
  shouldRender: boolean;
  isDrawingMode: boolean;
  strokes: Stroke[];
  watermarkText: string;
  highlights: HighlightRect[][];
  currentHighlight: number | null;
  zoomSettled: number;
  onStroke: (points: StrokePoint[]) => void;
  onVisible: (pageIndex: number, widthPx: number) => void;
}

export default function PdfPage({
  doc,
  pageIndex,
  aspectRatio,
  shouldRender,
  isDrawingMode,
  strokes,
  watermarkText,
  highlights,
  currentHighlight,
  zoomSettled,
  onStroke,
  onVisible,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedWidthRef = useRef<number | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const [rendered, setRendered] = useState(false);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onVisible(pageIndex, el.clientWidth);
          }
        }
      },
      { rootMargin: "150% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageIndex]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    if (!shouldRender) {
      renderTaskRef.current?.cancel();
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
      renderedWidthRef.current = null;
      setRendered(false);
      return;
    }

    const targetWidthCss = container.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidthPx = targetWidthCss * dpr;

    const already =
      renderedWidthRef.current !== null &&
      targetWidthPx <= renderedWidthRef.current * RERENDER_TOLERANCE;
    if (already) return;

    let cancelled = false;

    (async () => {
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = computeRenderScale(baseViewport.width, baseViewport.height, targetWidthPx);
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        return;
      } finally {
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      }
      if (cancelled) return;

      if (watermarkText) {
        drawWatermark(ctx, canvas.width, canvas.height, { text: watermarkText });
      }

      renderedWidthRef.current = targetWidthPx;
      setOverlaySize({ width: canvas.width, height: canvas.height });
      setRendered(true);
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [doc, pageIndex, shouldRender, watermarkText, zoomSettled]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: String(aspectRatio),
        background: "var(--paper-dim)",
        marginBottom: 8,
        overflow: "hidden",
      }}
      data-page-index={pageIndex}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {!rendered && (
        <div style={placeholderStyle}>
          <div style={spinnerStyle} />
        </div>
      )}
      {rendered && (
        <HighlightOverlay
          occurrences={highlights}
          currentOrdinal={currentHighlight}
          width={overlaySize.width}
          height={overlaySize.height}
        />
      )}
      {rendered && (
        <DrawingOverlay
          strokes={strokes}
          isDrawingMode={isDrawingMode}
          onStroke={onStroke}
          width={overlaySize.width}
          height={overlaySize.height}
        />
      )}
    </div>
  );
}

const placeholderStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const spinnerStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "3px solid rgba(0,0,0,0.15)",
  borderTopColor: "var(--md-primary)",
  animation: "spin 0.8s linear infinite",
};
