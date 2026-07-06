import { createOutbox, fetchCards, organiserSubmitCard } from "../sync/dropbox";
import { getState, mutate, Trip } from "./store";

/**
 * Pull this round's cards from the drop-box and merge them in — shared by
 * the round dashboard (polls continuously while open) and the trip home
 * screen (fetches once per round on open, so totals are right even if no
 * device has that round's dashboard open).
 *
 * Merge rule: a locally keyed/imported card always wins (an organiser
 * correction shouldn't be clobbered by a stale remote read); otherwise the
 * newer update wins. This keeps fetching even once a round is completed —
 * organisers can correct a card at any time (see pushOrganiserCard below),
 * so another device's edit still needs to reach this one.
 */
export async function fetchAndMergeCards(trip: Trip, round: number): Promise<void> {
  if (!trip.dropbox) return;
  const r = trip.rounds[round - 1];
  if (!r) return;
  const rows = await fetchCards(trip.dropbox, trip.id, trip.readKey, round);
  mutate((d) => {
    const t = d.trips.find((x) => x.id === trip.id)!;
    const rd = t.rounds[round - 1];
    if (!rd) return;
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

/**
 * Debounced push of one player's card as an organiser correction — works
 * at any time, including after the round is completed (unlike the
 * player/marker submitCard path). Used by the desk grid's live per-cell
 * edits; ManualCard's explicit Save button pushes directly instead since
 * it's already a deliberate one-shot action.
 */
const organiserOutboxes = new Map<string, ReturnType<typeof createOutbox>>();

export function pushOrganiserCard(trip: Trip, round: number, player: number): void {
  if (!trip.dropbox) return;
  const key = `${trip.id}:${round}:${player}`;
  let ob = organiserOutboxes.get(key);
  if (!ob) {
    ob = createOutbox({
      async send() {
        const t = getState().trips.find((x) => x.id === trip.id);
        const rd = t?.rounds[round - 1];
        const card = rd?.cards[player];
        if (!t?.dropbox || !card) return;
        await organiserSubmitCard(
          t.dropbox, t.id, t.readKey, round, player,
          t.players[player]?.name ?? "", card, rd!.cardMeta[player]?.final ?? rd!.completed,
        );
      },
      onStatus: () => {},
    });
    organiserOutboxes.set(key, ob);
  }
  ob.push();
}
