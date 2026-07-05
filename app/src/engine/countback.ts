/**
 * Australian countback ranking key.
 *
 * Compares, in order: net round points, back 9, last 6, last 3, then
 * hole-by-hole from the 18th down to the 13th (ties surviving all of that
 * are genuinely shared). Packed into one exact integer (max ~6e13, well
 * inside Number.MAX_SAFE_INTEGER) so ranking is a single comparison —
 * the same encoding the verified spreadsheet uses.
 */
export function countbackKey(net: number, pts: number[]): number {
  const b9 = sum(pts, 9, 18);
  const l6 = sum(pts, 12, 18);
  const l3 = sum(pts, 15, 18);
  return (
    net * 1e12 +
    b9 * 1e10 +
    l6 * 1e8 +
    l3 * 1e6 +
    pts[17] * 1e5 +
    pts[16] * 1e4 +
    pts[15] * 1e3 +
    pts[14] * 1e2 +
    pts[13] * 10 +
    pts[12]
  );
}

/** 1-based positions from keys: 1 + number of strictly better players. */
export function positionsFromKeys(keys: number[]): number[] {
  return keys.map((k) => 1 + keys.filter((o) => o > k).length);
}

/** True if this player's net total is shared with another player (countback decided). */
export function tiedOnNet(net: number[], p: number): boolean {
  return net.filter((n) => n === net[p]).length > 1;
}

function sum(a: number[], from: number, to: number): number {
  let s = 0;
  for (let i = from; i < to; i++) s += a[i];
  return s;
}
