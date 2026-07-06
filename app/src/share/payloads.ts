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

/** A single player's card as a link — organisers can import one directly. */
export interface CardPayload {
  v: 1;
  kind: "card";
  tripId: string;
  round: number; // 1-based
  player: number; // roster index
  name: string;
  scores: Card;
}

/**
 * "Organiser access" link: lets a second device (or a co-organiser) pick
 * up this trip — roster, courses, penalties, round completion, and cards
 * all pull automatically from the drop-box. Requires the trip to have a
 * drop-box configured.
 */
export interface OrgAccessPayload {
  v: 1;
  kind: "org";
  tripId: string;
  tripName: string;
  dropbox: DropboxConfig;
  writeKey: string;
  readKey: string;
}

export type SharePayload = RoundPackPayload | CardPayload | OrgAccessPayload;
