import { HOLES, RoundInput, RoundResult } from "./types";
import { holePoints, roundHalf } from "./stableford";
import { countbackKey, positionsFromKeys } from "./countback";

/**
 * Score one round for the whole field. Mirrors the verified spreadsheet:
 *  - stableford points per hole off the rounded daily handicap
 *  - absent players (no card) receive the rounded field average of the
 *    UNPENALISED totals of everyone who played, ranked like a real score
 *  - card penalties (0/1/2) come off the played player's total, floor 0
 *  - positions ranked on the countback key
 */
export function computeRound(input: RoundInput): RoundResult {
  const n = input.cards.length;
  const { pars, sis } = input.course;

  const pts: number[][] = [];
  const raw: number[] = [];
  const played: boolean[] = [];
  for (let p = 0; p < n; p++) {
    const card = input.cards[p];
    const row: number[] = [];
    for (let h = 0; h < HOLES; h++) {
      row.push(holePoints(card?.[h] ?? 0, pars[h], sis[h], input.dailyHcaps[p]));
    }
    pts.push(row);
    raw.push(row.reduce((a, b) => a + b, 0));
    played.push(!!card && card.some((s) => s > 0));
  }

  const inField = played.filter(Boolean).length;
  const avg = inField === 0 ? 0 : roundHalf(raw.filter((_, p) => played[p]).reduce((a, b) => a + b, 0) / inField);

  const net = raw.map((r, p) =>
    played[p] ? Math.max(0, r - (input.penalties[p] ?? 0)) : avg,
  );
  const key = net.map((nv, p) => countbackKey(nv, pts[p]));
  const pos = positionsFromKeys(key);

  return { pts, raw, played, avg, net, key, pos };
}
