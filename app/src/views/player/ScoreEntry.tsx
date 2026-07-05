import { useState } from "react";
import { mutate, playerCardKey, useAppState } from "../../state/store";
import { nav } from "../../router";
import { HOLES, holePoints, strokesReceived } from "../../engine";
import { pushCard } from "./playerSync";

export function ScoreEntry() {
  const { player } = useAppState();
  const pack = player.pack;
  const my = player.myIndex;
  const [hole, setHole] = useState(() => {
    if (!pack || my == null) return 0;
    const scores = player.cards[playerCardKey(pack.tripId, pack.round)]?.scores ?? [];
    const first = scores.findIndex((s) => !s);
    return first === -1 ? 17 : first;
  });
  const [wiped, setWiped] = useState<boolean[]>(() => Array(HOLES).fill(false));

  if (!pack || my == null) {
    nav("/player");
    return null;
  }
  const key = playerCardKey(pack.tripId, pack.round);
  const scores = player.cards[key]?.scores ?? Array(HOLES).fill(0);
  const me = pack.players[my];
  const par = pack.course.pars[hole];
  const si = pack.course.sis[hole];
  const strokes = strokesReceived(si, me.daily);
  const score = scores[hole];
  const isWiped = wiped[hole] && !score;
  const shown = score || (isWiped ? 0 : par); // default to par before first tap

  const set = (v: number) => {
    mutate((d) => {
      const c = d.player.cards[key] ?? { scores: Array(HOLES).fill(0), syncedAt: null };
      c.scores[hole] = v;
      d.player.cards[key] = c;
    });
    if (v === 0) setWiped((w) => w.map((x, i) => (i === hole ? true : x)));
    else if (wiped[hole]) setWiped((w) => w.map((x, i) => (i === hole ? false : x)));
    pushCard();
  };

  const commitShownIfUntouched = () => {
    // moving on from an untouched hole records the default (par)
    if (!score && !isWiped) set(par);
  };
  const go = (h: number) => {
    commitShownIfUntouched();
    setHole(Math.max(0, Math.min(HOLES - 1, h)));
  };

  const pts = holePoints(isWiped ? 0 : shown, par, si, me.daily);
  const totalPts = scores.reduce(
    (a, s, h) => a + holePoints(s, pack.course.pars[h], pack.course.sis[h], me.daily),
    0,
  );

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/player">‹ Card</a>
        <div className="titles">
          <div className="t">{pack.course.name}</div>
          <div className="s">Round {pack.round} · {firstWord(me.name)} · h'cap {me.daily} · {totalPts} pts</div>
        </div>
        <span />
      </div>
      <main>
        <div className="card">
          <div className="hole-head">
            <div className="hole-no num">{hole + 1}<small> / 18</small></div>
            <div className="hole-facts">
              Par <b className="num">{par}</b> · SI <b className="num">{si}</b><br />
              {strokes === 0 ? "no strokes here" : `${strokes} stroke${strokes > 1 ? "s" : ""} here`}
              {Array.from({ length: strokes }, (_, i) => <span className="strokes-dot" key={i} />)}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "18px 14px" }}>
          <div className="label" style={{ textAlign: "center" }}>Gross score</div>
          <div className="stepper">
            <button className="step-btn" aria-label="one less" disabled={isWiped || shown <= 1} onClick={() => set(shown - 1)}>−</button>
            {isWiped
              ? <div className="score-big wiped">WIPE</div>
              : <div className="score-big num" data-testid="score">{shown}</div>}
            <button className="step-btn" aria-label="one more" disabled={isWiped || shown >= 15} onClick={() => set(shown + 1)}>+</button>
          </div>
          <div className="pts-line">
            {isWiped ? <b style={{ color: "var(--flag)" }}>0 points</b> : <>
              {score ? "" : "tap + / − to set · "}
              <b>{pts} point{pts === 1 ? "" : "s"}</b>
            </>}
          </div>
          <button className="wipe-btn" onClick={() => (isWiped ? set(par) : set(0))}>
            {isWiped ? "Un-wipe: back to scoring" : "Wipe (no score) ✕"}
          </button>
        </div>

        <div className="card" style={{ padding: 9 }}>
          {[0, 9].map((off) => (
            <div className="holes-strip" style={{ marginBottom: off === 0 ? 4 : 0 }} key={off}>
              {Array.from({ length: 9 }, (_, i) => {
                const h = off + i;
                const s = scores[h];
                const hp = s ? holePoints(s, pack.course.pars[h], pack.course.sis[h], me.daily) : 0;
                return (
                  <button
                    key={h}
                    className={`hs num ${h === hole ? "cur" : s ? "done" : ""}`}
                    aria-label={`hole ${h + 1}${s ? `, score ${s}, ${hp} points` : ""}`}
                    onClick={() => go(h)}
                  >
                    {s ? (<>{s}<sup className={`sup-pts ${hp === 0 ? "zero" : ""}`}>{hp}</sup></>) : h + 1}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="btn-row">
          <button className="btn ghost" disabled={hole === 0} onClick={() => go(hole - 1)}>
            ‹ Hole {hole || 1}
          </button>
          {hole < 17 ? (
            <button className="btn" onClick={() => go(hole + 1)} data-testid="next-hole">Hole {hole + 2} ›</button>
          ) : (
            <button className="btn" onClick={() => { commitShownIfUntouched(); nav("/player"); }} data-testid="finish-card">
              Finish card ✓
            </button>
          )}
        </div>
      </main>
    </>
  );
}

function firstWord(n: string): string {
  return n.split(",")[1]?.trim() || n.split(" ")[0];
}
