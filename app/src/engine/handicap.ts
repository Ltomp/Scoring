/**
 * Daily handicap adjustment by finishing position, auto-scaled to field
 * size n: top half get cuts, bottom half increases, 0.25 per position
 * step, capped at ±maxAdj (default 2, the verified default); the middle
 * player of an odd field moves 0. maxAdj is only actually reached by the
 * top/bottom position once the field is large enough (half >= maxAdj*4) —
 * for smaller fields the step simply runs out before hitting the cap.
 */
export function adjustment(pos: number, n: number, maxAdj = 2): number {
  const half = Math.floor(n / 2);
  if (pos <= half) return -Math.min(maxAdj, 0.25 * (half - pos + 1));
  return Math.min(maxAdj, 0.25 * (pos - (n - half)));
}

export function adjustmentTable(n: number, maxAdj = 2): number[] {
  return Array.from({ length: n }, (_, i) => adjustment(i + 1, n, maxAdj));
}
