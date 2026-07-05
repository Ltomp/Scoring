import { RoundResult, TripInput, TripResult } from "./types";
import { roundHalf } from "./stableford";
import { adjustment } from "./handicap";
import { computeRound } from "./round";

/**
 * Compute the whole trip: handicap chain, every round, trip totals and
 * overall positions (total, then countback on the latest computed round).
 */
export function computeTrip(input: TripInput): TripResult {
  const n = input.players.length;
  const hcInto: number[][] = [];
  const daily: number[][] = [];
  const rounds: RoundResult[] = [];

  let hc = input.players.map((p) => p.hcap);
  for (const rd of input.rounds) {
    hcInto.push([...hc]);
    const dh = hc.map(roundHalf);
    daily.push(dh);
    const res = computeRound({
      course: rd.course,
      cards: rd.cards,
      penalties: rd.penalties,
      dailyHcaps: dh,
    });
    rounds.push(res);
    const active = res.played.some(Boolean);
    hc = hc.map((h, p) => h + (active ? adjustment(res.pos[p], n) : 0));
  }

  const totals = Array.from({ length: n }, (_, p) =>
    rounds.reduce((s, r) => s + r.net[p], 0),
  );
  const last = rounds[rounds.length - 1];
  const overallPos = totals.map(
    (t, p) =>
      1 +
      totals.filter(
        (o, q) => o > t || (o === t && last && last.key[q] > last.key[p]),
      ).length,
  );

  return { hcInto, daily, rounds, endHc: hc, totals, overallPos };
}
