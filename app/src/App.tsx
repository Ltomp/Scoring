import { JSX, useEffect } from "react";
import { nav, useRoute } from "./router";
import { decodePayload } from "./share/codec";
import { mutate, playerCardKey, useAppState } from "./state/store";
import { HOLES } from "./engine";
import { Home } from "./views/Home";
import { PlayerHome } from "./views/player/PlayerHome";
import { ScoreEntry } from "./views/player/ScoreEntry";
import { HandIn } from "./views/player/HandIn";
import { OrgHome } from "./views/organiser/OrgHome";
import { NewTrip } from "./views/organiser/NewTrip";
import { TripHome } from "./views/organiser/TripHome";
import { TripSetup } from "./views/organiser/TripSetup";
import { RoundDashboard } from "./views/organiser/RoundDashboard";
import { Results } from "./views/organiser/Results";

export function App(): JSX.Element {
  const route = useRoute();
  const state = useAppState();
  const [p0, p1, p2, p3, p4] = route.parts;

  // share import: #/i/<blob>
  useEffect(() => {
    if (p0 !== "i" || !p1) return;
    try {
      const payload = decodePayload(p1);
      if (payload.kind === "pack") {
        mutate((d) => {
          // a pack for a different trip retires the old player card view
          if (d.player.pack && d.player.pack.tripId !== payload.tripId) {
            d.player.myIndex = null;
            d.player.cards = {};
          }
          d.player.pack = payload;
          const k = playerCardKey(payload.tripId, payload.round);
          if (!d.player.cards[k]) d.player.cards[k] = { scores: Array(HOLES).fill(0), syncedAt: null };
        });
        nav("/player");
      } else {
        // a handed-in card for the organiser
        const trip = state.trips.find((t) => t.id === payload.tripId);
        if (!trip) {
          alert("Card received, but no matching trip exists on this phone. Only the trip organiser's phone can accept cards.");
          nav("/");
          return;
        }
        mutate((d) => {
          const t = d.trips.find((x) => x.id === payload.tripId)!;
          const r = t.rounds[payload.round - 1];
          if (!r || r.completed) {
            alert("That round is already completed — reopen it first to accept this card.");
            return;
          }
          if (payload.player < t.players.length) {
            r.cards[payload.player] = payload.scores;
            r.cardMeta[payload.player] = { source: "link", updatedAt: Date.now() };
          }
        });
        nav(`/org/t/${payload.tripId}/r/${payload.round}`);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "That link couldn't be read.");
      nav("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p0, p1]);

  if (p0 === "player") {
    if (p1 === "score") return <ScoreEntry />;
    if (p1 === "handin") return <HandIn />;
    return <PlayerHome />;
  }
  if (p0 === "org") {
    if (p1 === "new") return <NewTrip />;
    if (p1 === "t" && p2) {
      const trip = state.trips.find((t) => t.id === p2);
      if (!trip) return <OrgHome />;
      if (p3 === "setup") return <TripSetup trip={trip} />;
      if (p3 === "r" && p4) {
        const rn = Number(p4);
        if (route.parts[5] === "results") return <Results trip={trip} round={rn} />;
        return <RoundDashboard trip={trip} round={rn} />;
      }
      return <TripHome trip={trip} />;
    }
    return <OrgHome />;
  }
  return <Home />;
}
