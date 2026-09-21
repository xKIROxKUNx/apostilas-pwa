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
  element: HTMLElement;
  fracX: number;
  fracY: number;
  clientX: number;
  clientY: number;
}

function findPageElement(
  clientY: number,
  contentRef: React.RefObject<HTMLDivElement | null>,
  pageRefs?: React.RefObject<Map<number, HTMLDivElement>>,
): HTMLElement | null {
  const content = contentRef.current;
  const map = pageRefs?.current;
  const count = Math.max(map?.size ?? 0, content?.children.length ?? 0);
  if (count === 0) return content;

  const getElement = (index: number): HTMLElement | null => {
    return map?.get(index) ?? (content?.children[index] as HTMLElement | null) ?? null;
  };

  const firstEl = getElement(0);
  if (!firstEl) return content;
  const firstRect = firstEl.getBoundingClientRect();
  if (clientY < firstRect.top) return firstEl;

  const lastEl = getElement(count - 1);
  if (!lastEl) return content;
  const lastRect = lastEl.getBoundingClientRect();
  if (clientY > lastRect.bottom) return lastEl;

  let low = 0;
  let high = count - 1;
  let best = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const el = getElement(mid);
    if (!el) break;
    const rect = el.getBoundingClientRect();
    if (clientY < rect.top) {
      high = mid - 1;
    } else if (clientY > rect.bottom) {
      best = mid;
      low = mid + 1;
    } else {
      return el;
    }
  }

  return getElement(best) ?? firstEl;
}

export function useZoom(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  doubleTapEnabled = true,
  pageRefs?: React.RefObject<Map<number, HTMLDivElement>>,
) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;

  const anchorRef = useRef<Anchor | null>(null);
  const isPinchingRef = useRef(false);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const scroller = scrollRef.current;
    const target = anchor.element;
    if (!scroller || !target) return;

    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const desiredClientX = rect.left + anchor.fracX * rect.width;
    const desiredClientY = rect.top + anchor.fracY * rect.height;
    scroller.scrollLeft += desiredClientX - anchor.clientX;
    scroller.scrollTop += desiredClientY - anchor.clientY;

    if (!isPinchingRef.current) {
      anchorRef.current = null;
    }
  }, [zoom, scrollRef]);

  const zoomTo = useCallback(
    (next: number, clientX: number, clientY: number) => {
      const clamped = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
      if (clamped === zoomRef.current) return;

      let target = findPageElement(clientY, contentRef, pageRefs);
      let rect = target?.getBoundingClientRect();
      if (!target || !rect || rect.width <= 0 || rect.height <= 0) {
        target = contentRef.current;
        rect = target?.getBoundingClientRect();
      }
      if (target && rect && rect.width > 0 && rect.height > 0) {
        anchorRef.current = {
          element: target,
          fracX: (clientX - rect.left) / rect.width,
          fracY: (clientY - rect.top) / rect.height,
          clientX,
          clientY,
        };
      }
      setZoom(clamped);
    },
    [contentRef, pageRefs],
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

    const midpoint = (touches: TouchList) => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    function armPinch(touches: TouchList) {
      pinchStartDistance = distance(touches);
      pinchStartZoom = zoomRef.current;
      const mid = midpoint(touches);
      let target = findPageElement(mid.y, contentRef, pageRefs);
      let rect = target?.getBoundingClientRect();
      if (!target || !rect || rect.width <= 0 || rect.height <= 0) {
        target = contentRef.current;
        rect = target?.getBoundingClientRect();
      }
      if (target && rect && rect.width > 0 && rect.height > 0) {
        anchorRef.current = {
          element: target,
          fracX: (mid.x - rect.left) / rect.width,
          fracY: (mid.y - rect.top) / rect.height,
          clientX: mid.x,
          clientY: mid.y,
        };
        isPinchingRef.current = true;
      }
    }

    let disarmRaf = 0;

    function disarmPinch() {
      pinchStartDistance = 0;
      isPinchingRef.current = false;
      if (disarmRaf) cancelAnimationFrame(disarmRaf);
      disarmRaf = requestAnimationFrame(() => {
        disarmRaf = 0;
        if (!isPinchingRef.current) {
          anchorRef.current = null;
        }
      });
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
      const dist = distance(e.touches);
      const nextZoom = (pinchStartZoom * dist) / pinchStartDistance;
      const clamped = Math.min(Math.max(nextZoom, MIN_ZOOM), MAX_ZOOM);

      if (anchorRef.current) {
        anchorRef.current.clientX = mid.x;
        anchorRef.current.clientY = mid.y;
      }

      if (clamped === zoomRef.current) {
        const anchor = anchorRef.current;
        if (anchor && anchor.element) {
          const rect = anchor.element.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const desiredClientX = rect.left + anchor.fracX * rect.width;
            const desiredClientY = rect.top + anchor.fracY * rect.height;
            el!.scrollLeft += desiredClientX - mid.x;
            el!.scrollTop += desiredClientY - mid.y;
          }
        }
        return;
      }

      setZoom(clamped);
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

    function onGesture(e: Event) {
      e.preventDefault();
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);
    el.addEventListener("gesturestart", onGesture, { passive: false });
    el.addEventListener("gesturechange", onGesture, { passive: false });
    el.addEventListener("gestureend", onGesture, { passive: false });
    document.addEventListener("gesturestart", onGesture, { passive: false });
    document.addEventListener("gesturechange", onGesture, { passive: false });
    document.addEventListener("gestureend", onGesture, { passive: false });
    return () => {
      if (disarmRaf) cancelAnimationFrame(disarmRaf);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("gesturestart", onGesture);
      el.removeEventListener("gesturechange", onGesture);
      el.removeEventListener("gestureend", onGesture);
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("gestureend", onGesture);
    };
  }, [scrollRef, contentRef, pageRefs, zoomTo, enabled, doubleTapEnabled]);

  const resetZoom = useCallback(() => {
    isPinchingRef.current = false;
    anchorRef.current = null;
    setZoom(1);
  }, []);

  return { zoom, resetZoom };
}
