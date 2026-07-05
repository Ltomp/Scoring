import { useAppState } from "../state/store";
import { nav } from "../router";

export function Home() {
  const { player, trips } = useAppState();
  return (
    <>
      <div className="appbar">
        <div className="titles">
          <div className="t">Golf Trip Scoring</div>
          <div className="s">Scorecards · daily comp · trip handicaps</div>
        </div>
      </div>
      <main>
        <button className="btn home-choice" onClick={() => nav("/player")}>
          <span className="hc-t">My scorecard</span>
          <span className="hc-s" style={{ color: "rgba(255,255,255,.85)" }}>
            {player.pack
              ? `${player.pack.tripName} · Round ${player.pack.round}`
              : "Mark your playing partner's card (and track your own). Opens automatically when you tap a round link from an organiser."}
          </span>
        </button>
        <button className="btn ghost home-choice" onClick={() => nav("/org")}>
          <span className="hc-t">Organiser</span>
          <span className="hc-s">
            {trips.filter((t) => !t.archived).length
              ? `${trips.filter((t) => !t.archived).length} trip(s) on this phone`
              : "Set up a trip, collect cards, run the comp. Organisers only."}
          </span>
        </button>
        <p className="hint" style={{ padding: "0 6px" }}>
          Like on paper: each player marks their playing partner's card, checks it with
          them, then presses Submit. Cards reach the organisers automatically — only
          organisers ever see the comp.
        </p>
      </main>
    </>
  );
}
