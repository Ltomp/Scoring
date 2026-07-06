import { Course, MAX_ROUNDS } from "../engine";
import { createOutbox, loadTripState, saveTripState } from "../sync/dropbox";
import { getState, mutate, normaliseTrip, Trip } from "./store";

/**
 * Syncs the trip's roster/courses/penalties/round-completion — everything
 * needed to run the comp, short of the score cards themselves (those have
 * their own sync in cardSync.ts/gts_cards). This is what lets a second
 * organiser device pick a trip up without a JSON export/import: open the
 * trip's "organiser access" link, and this pulls straight from the
 * drop-box; any device that edits setup pushes its change back.
 *
 * Deliberately simple: whole-state upsert, newest write wins. A golf trip
 * has one or two organisers making occasional edits, not concurrent
 * high-frequency writers, so this doesn't need real conflict resolution.
 */

export interface TripMeta {
  name: string;
  year: string;
  players: { name: string; hcap: number }[];
  archived: boolean;
  roundsMeta: { course: Course | null; penalties: number[]; completed: boolean }[];
}

export function tripMetaOf(t: Trip): TripMeta {
  return {
    name: t.name,
    year: t.year,
    players: t.players,
    archived: t.archived,
    roundsMeta: t.rounds.map((r) => ({ course: r.course, penalties: r.penalties, completed: r.completed })),
  };
}

/** Merge remote meta into a local trip, preserving locally-held cards/cardMeta. */
export function applyTripMeta(t: Trip, m: TripMeta): void {
  t.name = m.name;
  t.year = m.year;
  t.archived = m.archived;
  t.players = m.players;
  const old = t.rounds;
  t.rounds = m.roundsMeta.slice(0, MAX_ROUNDS).map((rm, i) => ({
    course: rm.course,
    penalties: rm.penalties,
    completed: rm.completed,
    cards: old[i]?.cards ?? [],
    cardMeta: old[i]?.cardMeta ?? [],
  }));
  normaliseTrip(t);
}

const outboxes = new Map<string, ReturnType<typeof createOutbox>>();
export type TripSyncStatus = "synced" | "pending" | "offline";
const statusListeners = new Set<(tripId: string, s: TripSyncStatus) => void>();

export function onTripSyncStatus(l: (tripId: string, s: TripSyncStatus) => void): () => void {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}

function outboxFor(tripId: string) {
  let ob = outboxes.get(tripId);
  if (!ob) {
    ob = createOutbox({
      async send() {
        const t = getState().trips.find((x) => x.id === tripId);
        if (!t?.dropbox) return;
        await saveTripState(t.dropbox, t.id, t.readKey, tripMetaOf(t));
      },
      onStatus: (s) => statusListeners.forEach((l) => l(tripId, s)),
    });
    outboxes.set(tripId, ob);
  }
  return ob;
}

/** Call after any change to roster/courses/penalties/round completion/archive. */
export function pushTripMeta(tripId: string): void {
  const t = getState().trips.find((x) => x.id === tripId);
  if (!t?.dropbox) return;
  outboxFor(tripId).push();
}

/** One-shot pull + merge — call when opening a trip, or adopting one on a new device. */
export async function pullTripMeta(tripId: string): Promise<void> {
  const t = getState().trips.find((x) => x.id === tripId);
  if (!t?.dropbox) return;
  const res = await loadTripState<TripMeta>(t.dropbox, t.id, t.readKey);
  if (!res) return;
  mutate((d) => {
    const trip = d.trips.find((x) => x.id === tripId);
    if (trip) applyTripMeta(trip, res.state);
  });
}
