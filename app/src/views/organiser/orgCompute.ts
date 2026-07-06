import { computeTrip, TripInput, TripResult } from "../../engine";
import { Trip } from "../../state/store";

/** Rounds usable for computation: the contiguous prefix with a course set. */
export function computableRounds(trip: Trip): number {
  let n = 0;
  for (const r of trip.rounds) {
    if (!r.course) break;
    n++;
  }
  return n;
}

/** Compute the trip through round `upTo` (1-based; defaults to all computable). */
export function orgCompute(trip: Trip, upTo?: number): TripResult | null {
  const n = upTo ?? computableRounds(trip);
  if (trip.players.length === 0 || n === 0) return null;
  const input: TripInput = {
    players: trip.players,
    rounds: trip.rounds.slice(0, n).map((r) => ({
      course: r.course!,
      cards: r.cards,
      penalties: r.penalties,
    })),
    maxAdjustment: trip.maxAdjustment ?? 2,
  };
  return computeTrip(input);
}

/** Index (1-based) of the last round with any scores; 0 if none. */
export function lastActiveRound(trip: Trip): number {
  let last = 0;
  const n = computableRounds(trip);
  for (let i = 0; i < n; i++) {
    if (trip.rounds[i].cards.some((c) => c && c.some((s) => s > 0))) last = i + 1;
  }
  return last;
}
