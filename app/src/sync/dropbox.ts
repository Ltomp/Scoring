import { Card } from "../engine";
import { DropboxConfig } from "../share/payloads";

/**
 * Thin client for the Supabase "card drop-box" RPCs (see supabase/schema.sql).
 * Plain fetch, no SDK — the whole contract is four POST endpoints.
 */

export interface RemoteCard {
  round: number;
  player: number;
  name: string;
  scores: Card;
  done: boolean;
  updated_at: string;
}

async function rpc<T>(cfg: DropboxConfig, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${cfg.url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: cfg.anonKey,
      authorization: `Bearer ${cfg.anonKey}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function registerTrip(cfg: DropboxConfig, tripId: string, writeKey: string, readKey: string) {
  return rpc<void>(cfg, "gts_register_trip", {
    p_trip: tripId, p_write_key: writeKey, p_read_key: readKey,
  });
}

export function submitCard(
  cfg: DropboxConfig, tripId: string, writeKey: string,
  round: number, player: number, name: string, scores: Card, done: boolean,
) {
  return rpc<void>(cfg, "gts_submit_card", {
    p_trip: tripId, p_key: writeKey, p_round: round, p_player: player,
    p_name: name, p_scores: scores, p_done: done,
  });
}

export function fetchCards(cfg: DropboxConfig, tripId: string, readKey: string, round?: number) {
  return rpc<RemoteCard[]>(cfg, "gts_fetch_cards", {
    p_trip: tripId, p_key: readKey, p_round: round ?? null,
  });
}

export function completeRound(cfg: DropboxConfig, tripId: string, readKey: string, round: number, completed: boolean) {
  return rpc<void>(cfg, "gts_complete_round", {
    p_trip: tripId, p_key: readKey, p_round: round, p_completed: completed,
  });
}

export interface RemoteTripState<T> {
  state: T;
  updated_at: string;
}

/** Push the trip's roster/courses/penalties/completion state (not cards). */
export function saveTripState<T>(cfg: DropboxConfig, tripId: string, readKey: string, state: T) {
  return rpc<void>(cfg, "gts_save_trip_state", {
    p_trip: tripId, p_key: readKey, p_state: state,
  });
}

/** Pull it back down — used to adopt a trip on a new device, or refresh. */
export async function loadTripState<T>(cfg: DropboxConfig, tripId: string, readKey: string): Promise<RemoteTripState<T> | null> {
  const rows = await rpc<RemoteTripState<T>[]>(cfg, "gts_load_trip_state", {
    p_trip: tripId, p_key: readKey,
  });
  return rows[0] ?? null;
}

export interface RemoteTripListing<T> {
  id: string;
  writeKey: string;
  readKey: string;
  state: T | null;
  updatedAt: string;
}

/** Every trip registered against this drop-box project — no key needed (see schema.sql). */
export async function listTrips<T>(cfg: DropboxConfig): Promise<RemoteTripListing<T>[]> {
  const rows = await rpc<{ id: string; write_key: string; read_key: string; state: T | null; updated_at: string }[]>(
    cfg, "gts_list_trips", {},
  );
  return rows.map((r) => ({ id: r.id, writeKey: r.write_key, readKey: r.read_key, state: r.state, updatedAt: r.updated_at }));
}

/** Permanently removes a trip (and its cards/state) from the drop-box. */
export function deleteTrip(cfg: DropboxConfig, tripId: string, readKey: string) {
  return rpc<void>(cfg, "gts_delete_trip", { p_trip: tripId, p_key: readKey });
}

/**
 * Offline outbox: keeps trying to deliver the player's latest card until
 * the drop-box accepts it. Only the newest state matters (uploads are
 * idempotent upserts), so the outbox is a single slot, not a queue.
 */
export interface OutboxDeps {
  send: () => Promise<void>;
  onStatus: (status: "synced" | "pending" | "offline") => void;
  retryMs?: number;
}

export function createOutbox({ send, onStatus, retryMs = 15000 }: OutboxDeps) {
  let dirty = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function flush() {
    if (!dirty || inFlight) return;
    inFlight = true;
    try {
      dirty = false;
      await send();
      onStatus(dirty ? "pending" : "synced"); // dirty again if changed mid-flight
    } catch {
      dirty = true;
      onStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "pending");
    } finally {
      inFlight = false;
      if (dirty) schedule();
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, retryMs);
  }

  return {
    /** call whenever the card changes */
    push() {
      dirty = true;
      onStatus("pending");
      void flush();
    },
    /** call on 'online' / visibility events */
    kick() {
      void flush();
    },
    get isDirty() {
      return dirty;
    },
  };
}
