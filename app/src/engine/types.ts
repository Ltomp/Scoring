export const HOLES = 18;
export const MAX_PLAYERS = 32;
export const MAX_ROUNDS = 10;

export interface Course {
  name: string;
  /** par per hole, length 18, each 3..6 */
  pars: number[];
  /** stroke index per hole, length 18, a permutation of 1..18 */
  sis: number[];
}

/** A player's gross scores for a round. 0 = wiped hole (no score). */
export type Card = number[];

export interface RoundInput {
  course: Course;
  /** one entry per rostered player; null = absent (no card) */
  cards: (Card | null)[];
  /** card penalty per player, 0 | 1 | 2 */
  penalties: number[];
  /** rounded daily handicap per player */
  dailyHcaps: number[];
}

export interface RoundResult {
  /** stableford points per player per hole */
  pts: number[][];
  /** unpenalised round total per player */
  raw: number[];
  played: boolean[];
  /** field-average points awarded to absentees (rounded, pre-penalty) */
  avg: number;
  /** final round points: max(0, raw - penalty) if played, else avg */
  net: number[];
  /** countback ranking key (integer, higher is better) */
  key: number[];
  /** daily position, 1-based; ties split by Australian countback */
  pos: number[];
}

export interface TripInput {
  players: { name: string; hcap: number }[];
  rounds: {
    course: Course;
    cards: (Card | null)[];
    penalties: number[];
  }[];
  /** cap on the daily handicap adjustment (default 2, the verified default) */
  maxAdjustment?: number;
}

export interface TripResult {
  /** running handicap going INTO each round, [round][player] */
  hcInto: number[][];
  /** rounded daily handicap used on the card, [round][player] */
  daily: number[][];
  rounds: RoundResult[];
  /** handicap after the final computed round */
  endHc: number[];
  /** trip totals per player */
  totals: number[];
  /** overall position, ties split by countback on the latest round */
  overallPos: number[];
}
