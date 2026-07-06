import { JSX, useEffect } from "react";
import { nav, useRoute } from "./router";
import { decodePayload } from "./share/codec";
import { adoptTrip, emptyPlayerCard, getState, mutate, playerCardKey, useAppState } from "./state/store";
import { pullTripMeta } from "./state/tripSync";
import { fetchAndMergeAllCards } from "./state/cardSync";
import { Home } from "./views/Home";
import { PlayerHome } from "./views/player/PlayerHome";
import { ScoreEntry } from "./views/player/ScoreEntry";
import { SubmitRound } from "./views/player/SubmitRound";
import { MyCard } from "./views/player/MyCard";
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
          if (!d.player.cards[k]) d.player.cards[k] = emptyPlayerCard();
        });
        nav("/player");
      } else if (payload.kind === "org") {
        // organiser access link: adopt (or re-adopt) this trip, then pull its
        // current roster/courses/penalties/cards straight from the drop-box
        mutate((d) => {
          if (!d.trips.some((t) => t.id === payload.tripId)) d.trips.unshift(adoptTrip(payload));
        });
        nav(`/org/t/${payload.tripId}`);
        pullTripMeta(payload.tripId)
          .then(() => {
            const t = getState().trips.find((x) => x.id === payload.tripId);
            return t ? fetchAndMergeAllCards(t) : undefined;
          })
          .catch((e) => alert(e instanceof Error ? e.message : "Couldn't load that trip."));
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
            r.cardMeta[payload.player] = { source: "link", updatedAt: Date.now(), final: true };
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

  let view: JSX.Element;
  if (p0 === "player") {
    if (p1 === "score") view = <ScoreEntry />;
    else if (p1 === "submit") view = <SubmitRound />;
    else if (p1 === "mine") view = <MyCard />;
    else view = <PlayerHome />;
  } else if (p0 === "org") {
    const trip = p1 === "t" && p2 ? state.trips.find((t) => t.id === p2) : undefined;
    if (p1 === "new") view = <NewTrip />;
    else if (trip && p3 === "setup") view = <TripSetup trip={trip} />;
    else if (trip && p3 === "r" && p4) {
      const rn = Number(p4);
      view = route.parts[5] === "results"
        ? <Results trip={trip} round={rn} />
        : <RoundDashboard trip={trip} round={rn} />;
    } else if (trip) view = <TripHome trip={trip} />;
    else view = <OrgHome />;
  } else {
    view = <Home />;
  }

  // organiser routes widen into the desk layout on laptops
  return <div className={p0 === "org" ? "shell wide" : "shell"}>{view}</div>;
}
