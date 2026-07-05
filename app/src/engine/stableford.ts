/** Excel-style ROUND: half away from zero. */
export function roundHalf(x: number): number {
  const r = Math.floor(Math.abs(x) + 0.5);
  return x < 0 ? -r : r;
}

/** Strokes received on a hole: up to 3 for daily handicaps to 54. */
export function strokesReceived(si: number, dailyHcap: number): number {
  return (si <= dailyHcap ? 1 : 0) + (si + 18 <= dailyHcap ? 1 : 0) + (si + 36 <= dailyHcap ? 1 : 0);
}

/** Stableford points for one hole. score 0 (or missing) = wipe = 0 points. */
export function holePoints(score: number, par: number, si: number, dailyHcap: number): number {
  if (!score) return 0;
  return Math.max(0, par + 2 - score + strokesReceived(si, dailyHcap));
}
