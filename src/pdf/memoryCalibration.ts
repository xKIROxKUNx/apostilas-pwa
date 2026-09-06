const CALIBRATION_POINTS: Array<[ramGb: number, pages: number]> = [
  [2, 6],
  [4, 10],
  [6, 15],
  [8, 20],
  [16, 50],
];

const ABSOLUTE_MAX_CACHED_PAGES = 60;

interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

export function maxCachedPagesForRamGb(ramGb: number): number {
  const points = CALIBRATION_POINTS;

  if (ramGb <= points[0][0]) return points[0][1];

  const last = points[points.length - 1];
  if (ramGb >= last[0]) {
    const prev = points[points.length - 2];
    const slope = (last[1] - prev[1]) / (last[0] - prev[0]);
    const extrapolated = last[1] + slope * (ramGb - last[0]);
    return Math.min(Math.max(Math.trunc(extrapolated), last[1]), ABSOLUTE_MAX_CACHED_PAGES);
  }

  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (ramGb >= x0 && ramGb <= x1) {
      const t = (ramGb - x0) / (x1 - x0);
      return Math.trunc(y0 + t * (y1 - y0));
    }
  }

  return points[0][1];
}

export function maxCachedPagesForDevice(): number {
  const ramGb = (navigator as NavigatorWithDeviceMemory).deviceMemory;
  if (!ramGb) return CALIBRATION_POINTS[0][1];
  return maxCachedPagesForRamGb(ramGb);
}
