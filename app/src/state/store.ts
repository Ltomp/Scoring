import { useSyncExternalStore } from "react";
import { Card, Course, MAX_PLAYERS, MAX_ROUNDS } from "../engine";
import { DropboxConfig, RoundPackPayload } from "../share/payloads";

// ---------------------------------------------------------------- types

export type CardSource = "sync" | "link" | "manual";

export interface TripRound {
  course: Course | null;
  /** received cards, indexed by roster position; null = nothing yet */
  cards: (Card | null)[];
  cardMeta: ({ source: CardSource; updatedAt: number } | null)[];
  penalties: number[];
  completed: boolean;
}

export interface Trip {
  id: string;
  name: string;
  year: string;
  createdAt: number;
  players: { name: string; hcap: number }[];
  rounds: TripRound[];
  dropbox: DropboxConfig | null;
  writeKey: string;
  readKey: string;
  archived: boolean;
}

export interface PlayerCardState {
  scores: Card;
  /** last time the card was accepted by the drop-box, ms epoch */
  syncedAt: number | null;
}

export interface PlayerState {
  pack: RoundPackPayload | null;
  myIndex: number | null;
  /** keyed `${tripId}:${round}` */
  cards: Record<string, PlayerCardState>;
}

export interface AppState {
  trips: Trip[];
  player: PlayerState;
}

// ---------------------------------------------------------------- persistence

const KEY = "gts.state.v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as AppState;
  } catch {
    /* corrupted or unavailable storage -> start clean */
  }
  return { trips: [], player: { pack: null, myIndex: null, cards: {} } };
}

let state: AppState = load();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function mutate(fn: (draft: AppState) => void): void {
  const next = structuredClone(state);
  fn(next);
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full/unavailable; keep going in memory */
  }
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

// ---------------------------------------------------------------- helpers

export function randomKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function emptyRound(nPlayers: number): TripRound {
  return {
    course: null,
    cards: Array(nPlayers).fill(null),
    cardMeta: Array(nPlayers).fill(null),
    penalties: Array(nPlayers).fill(0),
    completed: false,
  };
}

export function createTrip(
  name: string,
  year: string,
  dropbox: DropboxConfig | null,
  players: { name: string; hcap: number }[] = [],
): Trip {
  return {
    id: crypto.randomUUID(),
    name,
    year,
    createdAt: Date.now(),
    players: players.slice(0, MAX_PLAYERS),
    rounds: [],
    dropbox,
    writeKey: randomKey(),
    readKey: randomKey(),
    archived: false,
  };
}

/** Resize per-player arrays when the roster changes; cap rounds at 10. */
export function normaliseTrip(t: Trip): void {
  const n = t.players.length;
  t.rounds = t.rounds.slice(0, MAX_ROUNDS);
  for (const r of t.rounds) {
    r.cards = Array.from({ length: n }, (_, i) => r.cards[i] ?? null);
    r.cardMeta = Array.from({ length: n }, (_, i) => r.cardMeta[i] ?? null);
    r.penalties = Array.from({ length: n }, (_, i) => r.penalties[i] ?? 0);
  }
}

export function playerCardKey(tripId: string, round: number): string {
  return `${tripId}:${round}`;
}
