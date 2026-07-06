import { useAppState } from "../state/store";
import { nav } from "../router";

/** Player-only landing. Organisers have their own separate page (#/org) —
 *  deliberately not linked from here, so players never see it. */
export function Home() {
  const { player } = useAppState();
  return (
    <>
      <div className="appbar">
        <div className="titles">
          <div className="t">Golf Trip Scoring</div>
          <div className="s">Mark your card · check it with your partner</div>
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
        <p className="hint" style={{ padding: "0 6px" }}>
          Like on paper: each player marks their playing partner's card, checks it with
          them, then presses Submit. Cards reach the organisers automatically — only
          organisers ever see the comp.
        </p>
      </main>
    </>
  );
}
