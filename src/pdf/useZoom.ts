import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 5;
const DOUBLE_TAP_ZOOM = 2;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 30;

const TAP_SLOP_PX = 10;
const TAP_MAX_MS = 250;
const SCROLL_TOLERANCE_PX = 2;

interface Anchor {
  element: HTMLElement | null;
  fracX: number;
  fracY: number;
  clientX: number;
  clientY: number;
}

function pageElementAt(clientX: number, clientY: number): HTMLElement | null {
  const hit = document.elementFromPoint(clientX, clientY);
  return (hit?.closest("[data-page-index]") as HTMLElement | null) ?? null;
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

  const anchorRef = useRef<Anchor | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    const scroller = scrollRef.current;
    const target = anchor?.element ?? contentRef.current;
    if (!anchor || !scroller || !target) return;

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const desiredClientX = rect.left + anchor.fracX * rect.width;
    const desiredClientY = rect.top + anchor.fracY * rect.height;
    scroller.scrollLeft += desiredClientX - anchor.clientX;
    scroller.scrollTop += desiredClientY - anchor.clientY;
  }, [zoom, scrollRef, contentRef]);

  const zoomTo = useCallback(
    (next: number, clientX: number, clientY: number) => {
      const clamped = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
      if (clamped === zoomRef.current) return;

      const target = pageElementAt(clientX, clientY) ?? contentRef.current;
      if (target) {
        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          anchorRef.current = {
            element: target === contentRef.current ? null : target,
            fracX: (clientX - rect.left) / rect.width,
            fracY: (clientY - rect.top) / rect.height,
            clientX,
            clientY,
          };
        }
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
    let panLastX: number | null = null;
    let panLastY: number | null = null;
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

    const midpoint = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    function armPinch(touches: TouchList) {
      pinchStartDistance = distance(touches);
      pinchStartZoom = zoomRef.current;
      const mid = midpoint(touches);
      panLastX = mid.x;
      panLastY = mid.y;
    }

    function disarmPinch() {
      pinchStartDistance = 0;
      panLastX = null;
      panLastY = null;
    }

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

      if (e.touches.length !== 2) {
        disarmPinch();
        return;
      }
      e.preventDefault();
      armPinch(e.touches);
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

      const mid = midpoint(e.touches);
      if (panLastX !== null && panLastY !== null) {
        el!.scrollLeft -= mid.x - panLastX;
        el!.scrollTop -= mid.y - panLastY;
      }
      panLastX = mid.x;
      panLastY = mid.y;

      zoomTo((pinchStartZoom * distance(e.touches)) / pinchStartDistance, mid.x, mid.y);
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length === 2) {
        armPinch(e.touches);
        return;
      }
      if (e.touches.length < 2) disarmPinch();
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
      disarmPinch();
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

  return { zoom, resetZoom };
}
