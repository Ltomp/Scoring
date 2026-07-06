/**
 * Daily handicap adjustment by finishing position, linearly interpolated
 * across the field: the winner (pos 1) always loses exactly maxAdj (default
 * 2), last place always gains exactly maxAdj, and every position between is
 * spaced in equal steps scaled to the field size n. The middle of an odd
 * field moves 0.
 */
export function adjustment(pos: number, n: number, maxAdj = 2): number {
  if (n <= 1) return 0;
  return maxAdj * ((2 * (pos - 1)) / (n - 1) - 1);
}

export function adjustmentTable(n: number, maxAdj = 2): number[] {
  return Array.from({ length: n }, (_, i) => adjustment(i + 1, n, maxAdj));
}
