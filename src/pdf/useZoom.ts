import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ZOOM_RERENDER_DEBOUNCE_MS } from "./renderScale";

export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 30;

const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 250;
const SCROLL_TOLERANCE_PX = 2;

interface Anchor {
  fracX: number;
  fracY: number;
  clientX: number;
  clientY: number;
}

export function useZoom(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  doubleTapEnabled = true,
) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;

  const [zoomSettled, setZoomSettled] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => setZoomSettled(zoom), ZOOM_RERENDER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [zoom]);

  const anchorRef = useRef<Anchor | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!anchor || !scroller || !content) return;

    const rect = content.getBoundingClientRect();
    const desiredClientX = rect.left + anchor.fracX * rect.width;
    const desiredClientY = rect.top + anchor.fracY * rect.height;
    scroller.scrollLeft += desiredClientX - anchor.clientX;
    scroller.scrollTop += desiredClientY - anchor.clientY;
  }, [zoom, scrollRef, contentRef]);

  const zoomTo = useCallback(
    (next: number, clientX: number, clientY: number) => {
      const content = contentRef.current;
      if (!content) return;
      const clamped = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
      const rect = content.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        anchorRef.current = {
          fracX: (clientX - rect.left) / rect.width,
          fracY: (clientY - rect.top) / rect.height,
          clientX,
          clientY,
        };
      }
      setZoom(clamped);
    },
    [contentRef],
  );

  useEffect(() => {
    if (!enabled) return;
    const el = scrollRef.current;
    if (!el) return;

    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let lastTapAt = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    let gestureIsTap = false;
    let gestureStartAt = 0;
    let gestureStartX = 0;
    let gestureStartY = 0;
    let gestureStartScrollTop = 0;
    let gestureStartScrollLeft = 0;

    const distance = (touches: TouchList) =>
      Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      );

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        gestureIsTap = true;
        gestureStartAt = Date.now();
        gestureStartX = touch.clientX;
        gestureStartY = touch.clientY;
        gestureStartScrollTop = el!.scrollTop;
        gestureStartScrollLeft = el!.scrollLeft;
        return;
      }

      gestureIsTap = false;
      lastTapAt = 0;

      if (e.touches.length !== 2) return;
      e.preventDefault();
      pinchStartDistance = distance(e.touches);
      pinchStartZoom = zoomRef.current;
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 1) {
        if (!gestureIsTap) return;
        const touch = e.touches[0];
        const andou = Math.hypot(
          touch.clientX - gestureStartX,
          touch.clientY - gestureStartY,
        );
        if (andou > TAP_SLOP_PX) gestureIsTap = false;
        return;
      }
      if (e.touches.length !== 2 || pinchStartDistance <= 0) return;
      e.preventDefault();
      const ratio = distance(e.touches) / pinchStartDistance;
      zoomTo(
        pinchStartZoom * ratio,
        (e.touches[0].clientX + e.touches[1].clientX) / 2,
        (e.touches[0].clientY + e.touches[1].clientY) / 2,
      );
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) pinchStartDistance = 0;
      if (e.touches.length !== 0 || e.changedTouches.length !== 1) return;

      const touch = e.changedTouches[0];
      const now = Date.now();

      const rolou =
        Math.abs(el!.scrollTop - gestureStartScrollTop) > SCROLL_TOLERANCE_PX ||
        Math.abs(el!.scrollLeft - gestureStartScrollLeft) > SCROLL_TOLERANCE_PX;
      const foiToque = gestureIsTap && now - gestureStartAt <= TAP_MAX_MS && !rolou;
      gestureIsTap = false;

      if (!foiToque) {
        lastTapAt = 0;
        return;
      }
      if (!doubleTapEnabled) return;

      const perto =
        Math.abs(touch.clientX - lastTapX) < DOUBLE_TAP_SLOP_PX &&
        Math.abs(touch.clientY - lastTapY) < DOUBLE_TAP_SLOP_PX;
      if (now - lastTapAt < DOUBLE_TAP_MS && perto) {
        zoomTo(
          zoomRef.current !== 1 ? 1 : DOUBLE_TAP_ZOOM,
          touch.clientX,
          touch.clientY,
        );
        lastTapAt = 0;
      } else {
        lastTapAt = now;
        lastTapX = touch.clientX;
        lastTapY = touch.clientY;
      }
    }

    function onTouchCancel() {
      pinchStartDistance = 0;
      gestureIsTap = false;
      lastTapAt = 0;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [scrollRef, zoomTo, enabled, doubleTapEnabled]);

  const resetZoom = useCallback(() => {
    anchorRef.current = null;
    setZoom(1);
  }, []);

  return { zoom, zoomSettled, resetZoom };
}
