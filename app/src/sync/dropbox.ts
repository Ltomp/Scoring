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
