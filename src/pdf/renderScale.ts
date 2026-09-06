export const MIN_RENDER_SCALE = 1;
export const MAX_RENDER_SCALE = 4;
export const MAX_CANVAS_DIMENSION_PX = 4096;
export const RERENDER_TOLERANCE = 1.1;
export const ZOOM_RERENDER_DEBOUNCE_MS = 350;

export function computeRenderScale(
  pageWidthPt: number,
  pageHeightPt: number,
  targetWidthPx: number,
): number {
  if (pageWidthPt <= 0) return MIN_RENDER_SCALE;
  const rawScale = targetWidthPx / pageWidthPt;
  const longestSidePt = Math.max(pageWidthPt, pageHeightPt);
  const maxScaleForSize =
    longestSidePt > 0 ? MAX_CANVAS_DIMENSION_PX / longestSidePt : MAX_RENDER_SCALE;
  const cap = Math.min(MAX_RENDER_SCALE, maxScaleForSize);
  return Math.min(Math.max(rawScale, MIN_RENDER_SCALE), cap);
}
