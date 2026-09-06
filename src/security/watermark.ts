export interface WatermarkOptions {
  text: string;
  opacity?: number;
  fontSizeRatio?: number;
  padding?: number;
}

const DEFAULTS: Required<Omit<WatermarkOptions, "text">> = {
  opacity: 0.35,
  fontSizeRatio: 0.02,
  padding: 12,
};

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  options: WatermarkOptions,
): void {
  const { text, opacity, fontSizeRatio, padding } = {
    ...DEFAULTS,
    ...options,
  };
  if (!text.trim()) return;

  const fontSize = Math.max(9, canvasWidth * fontSizeRatio);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = "#000000";
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "right";
  ctx.fillText(text, canvasWidth - padding, canvasHeight - padding);
  ctx.restore();
}
