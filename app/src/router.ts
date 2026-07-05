import { useSyncExternalStore } from "react";

/**
 * Tiny hash router. Routes:
 *   #/                     home
 *   #/player               player home (today)
 *   #/player/score         score entry
 *   #/player/submit        review & submit the marked card
 *   #/org                  trips list
 *   #/org/new              new trip
 *   #/org/t/:id            trip home (rounds + leaderboard)
 *   #/org/t/:id/setup      roster / courses / drop-box
 *   #/org/t/:id/r/:n       round dashboard
 *   #/org/t/:id/r/:n/results   daily results
 *   #/i/:blob              share import (round pack or card)
 */
export interface Route {
  parts: string[];
}

function parse(): Route {
  const hash = location.hash.replace(/^#\/?/, "");
  return { parts: hash ? hash.split("/") : [] };
}

let route = parse();
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => {
  route = parse();
  listeners.forEach((l) => l());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => route,
  );
}

export function nav(path: string): void {
  location.hash = path.startsWith("#") ? path : `#${path}`;
}
