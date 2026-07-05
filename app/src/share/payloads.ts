import { Card, Course } from "../engine";

/** Drop-box connection details (Supabase project + trip write key). */
export interface DropboxConfig {
  url: string;
  anonKey: string;
}

/**
 * Morning "round pack" the organiser shares: everything a player's app
 * needs for the day. Contains no scores.
 */
export interface RoundPackPayload {
  v: 1;
  kind: "pack";
  tripId: string;
  tripName: string;
  round: number; // 1-based
  course: Course;
  players: { name: string; daily: number }[];
  dropbox: (DropboxConfig & { writeKey: string }) | null;
}

/** A single player's card, for the offline QR/link hand-in fallback. */
export interface CardPayload {
  v: 1;
  kind: "card";
  tripId: string;
  round: number; // 1-based
  player: number; // roster index
  name: string;
  scores: Card;
}

export type SharePayload = RoundPackPayload | CardPayload;
