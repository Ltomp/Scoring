import { fetchCards } from "../sync/dropbox";
import { mutate, Trip } from "./store";

/**
 * Pull this round's cards from the drop-box and merge them in — shared by
 * the round dashboard (polls continuously while open) and the trip home
 * screen (fetches once per round on open, so totals are right even if no
 * device has that round's dashboard open).
 *
 * Merge rule: a locally keyed/imported card always wins (an organiser
 * correction shouldn't be clobbered by a stale remote read); otherwise the
 * newer update wins.
 */
export async function fetchAndMergeCards(trip: Trip, round: number): Promise<void> {
  if (!trip.dropbox) return;
  const r = trip.rounds[round - 1];
  if (!r || r.completed) return;
  const rows = await fetchCards(trip.dropbox, trip.id, trip.readKey, round);
  mutate((d) => {
    const t = d.trips.find((x) => x.id === trip.id)!;
    const rd = t.rounds[round - 1];
    if (!rd || rd.completed) return;
    for (const row of rows) {
      if (row.player >= t.players.length) continue;
      const meta = rd.cardMeta[row.player];
      if (meta?.source === "manual") continue; // organiser corrections win
      const remoteAt = Date.parse(row.updated_at);
      if (meta && meta.source !== "sync" && meta.updatedAt >= remoteAt) continue;
      rd.cards[row.player] = row.scores;
      rd.cardMeta[row.player] = { source: "sync", updatedAt: remoteAt, final: row.done };
    }
  });
}

/** Fetch every round that has a course, so trip-level totals are current. */
export async function fetchAndMergeAllCards(trip: Trip): Promise<void> {
  if (!trip.dropbox) return;
  await Promise.all(
    trip.rounds.map((r, i) => (r.course ? fetchAndMergeCards(trip, i + 1) : Promise.resolve())),
  );
}
