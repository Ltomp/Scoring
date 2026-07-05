/**
 * Daily handicap adjustment by finishing position, auto-scaled to field
 * size n: top half get cuts, bottom half increases, 0.25 per position
 * step, capped at ±2; the middle player of an odd field moves 0.
 */
export function adjustment(pos: number, n: number): number {
  const half = Math.floor(n / 2);
  if (pos <= half) return -Math.min(2, 0.25 * (half - pos + 1));
  return Math.min(2, 0.25 * (pos - (n - half)));
}

export function adjustmentTable(n: number): number[] {
  return Array.from({ length: n }, (_, i) => adjustment(i + 1, n));
}
