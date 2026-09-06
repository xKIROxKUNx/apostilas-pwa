import { useEffect, useRef, useState } from "react";
import type { TocEntry } from "@/types/domain";
import { chapterTitleForPage } from "./usePdfDocument";

const HIDE_DELAY_MS = 1500;
const THUMB_H = 26;

interface FastScrollerProps {
  pageCount: number;
  toc: TocEntry[];
  scrollFraction: number;
  onSeek: (pageIndex: number) => void;
}

export default function FastScroller({
  pageCount,
  toc,
  scrollFraction,
  onSeek,
}: FastScrollerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState(0);
  const [visible, setVisible] = useState(false);
  const lastSeekedPage = useRef(-1);

  useEffect(() => {
    setVisible(true);
    if (dragging) return;
    const timer = setTimeout(() => setVisible(false), HIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [scrollFraction, dragging]);

  if (pageCount <= 1) return null;

  const fraction = dragging ? dragFraction : scrollFraction;
  const draggedPage = pageForFraction(dragFraction, pageCount);
  const chapterTitle = chapterTitleForPage(toc, draggedPage);

  function handleMove(clientY: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const util = Math.max(rect.height - THUMB_H, 1);
    const f = Math.min(Math.max((clientY - rect.top - THUMB_H / 2) / util, 0), 1);
    setDragFraction(f);

    const target = pageForFraction(f, pageCount);
    if (target !== lastSeekedPage.current) {
      lastSeekedPage.current = target;
      onSeek(target);
    }
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    lastSeekedPage.current = -1;
    handleMove(e.clientY);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    handleMove(e.clientY);
  }

  function handlePointerUp() {
    setDragging(false);
  }

  return (
    <div
      style={{
        ...styles.wrapper,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <div
        ref={trackRef}
        style={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div style={styles.trackLine} />
        <div
          style={{
            ...styles.thumb,
            top: `calc(${fraction} * (100% - ${THUMB_H}px))`,
            background: dragging
              ? "var(--md-primary)"
              : "color-mix(in srgb, var(--md-primary) 55%, transparent)",
          }}
        />
      </div>

      {dragging && (
        <div style={{ ...styles.tooltip, top: `calc(${fraction} * (100% - ${THUMB_H}px) + ${THUMB_H / 2}px)` }}>
          <p className="m3-label-medium" style={{ margin: 0, color: "var(--md-inverse-on-surface)" }}>
            {draggedPage + 1} / {pageCount}
          </p>
          {chapterTitle && <p className="m3-title-small" style={styles.tooltipTitle}>{chapterTitle}</p>}
        </div>
      )}
    </div>
  );
}

function pageForFraction(fraction: number, pageCount: number): number {
  if (pageCount <= 1) return 0;
  const page = Math.round(fraction * (pageCount - 1));
  return Math.min(Math.max(page, 0), pageCount - 1);
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 32,
    zIndex: "var(--z-scroller)" as unknown as number,
    transition: "opacity 200ms ease",
  },
  track: {
    position: "absolute",
    top: 12,
    bottom: 12,
    left: 0,
    right: 0,
    touchAction: "none",
  },
  trackLine: {
    position: "absolute",
    right: 3,
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: "var(--md-shape-full)",
    background: "var(--md-outline-variant)",
  },
  thumb: {
    position: "absolute",
    right: 0,
    width: 10,
    height: THUMB_H,
    borderRadius: "var(--md-shape-full)",
    boxShadow: "var(--md-elev-1)",
  },
  tooltip: {
    position: "absolute",
    right: 40,
    transform: "translateY(-50%)",
    background: "var(--md-inverse-surface)",
    borderRadius: "var(--md-shape-md)",
    padding: "10px 14px",
    boxShadow: "var(--md-elev-3)",
    minWidth: 140,
    maxWidth: 220,
  },
  tooltipTitle: {
    margin: "4px 0 0",
    color: "var(--md-inverse-on-surface)",
    fontWeight: 700,
  },
};
