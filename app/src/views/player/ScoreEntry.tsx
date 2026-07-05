import { useState } from "react";
import { emptyPlayerCard, mutate, playerCardKey, useAppState } from "../../state/store";
import { nav } from "../../router";
import { HOLES, holePoints, strokesReceived } from "../../engine";
import { pushCard } from "./playerSync";
import { firstName } from "./PlayerHome";

export function ScoreEntry() {
  const { player } = useAppState();
  const pack = player.pack;
  const my = player.myIndex;
  const key = pack ? playerCardKey(pack.tripId, pack.round) : "";
  const card = (pack && player.cards[key]) || emptyPlayerCard();
  const [hole, setHole] = useState(() => {
    const first = card.scores.findIndex((s) => !s);
    return first === -1 ? HOLES - 1 : first;
  });
  const [wiped, setWiped] = useState<boolean[]>(() => Array(HOLES).fill(false));

  if (!pack || my == null || card.markIndex == null || card.submittedAt != null) {
    nav("/player");
    return null;
  }
  const me = pack.players[my];
  const partner = pack.players[card.markIndex];
  const par = pack.course.pars[hole];
  const si = pack.course.sis[hole];
  const score = card.scores[hole];
  const isWiped = wiped[hole] && !score;
  const shown = score || (isWiped ? 0 : par);

  const update = (fn: (c: { scores: number[]; tally: number[] }) => void) => {
    mutate((d) => {
      const c = d.player.cards[key] ?? emptyPlayerCard();
      fn(c);
      d.player.cards[key] = c;
    });
  };
  const setPartner = (v: number) => {
    update((c) => { c.scores[hole] = v; });
    if (v === 0) setWiped((w) => w.map((x, i) => (i === hole ? true : x)));
    else if (wiped[hole]) setWiped((w) => w.map((x, i) => (i === hole ? false : x)));
    pushCard();
  };
  const setTally = (v: number) => update((c) => { c.tally[hole] = v; }); // own tally stays on this phone

  const commitShownIfUntouched = () => {
    if (!score && !isWiped) setPartner(par);
  };
  const go = (h: number) => {
    commitShownIfUntouched();
    setHole(Math.max(0, Math.min(HOLES - 1, h)));
  };

  const pPts = holePoints(isWiped ? 0 : shown, par, si, partner.daily);
  const pStrokes = strokesReceived(si, partner.daily);
  const totalPts = card.scores.reduce(
    (a, s, h) => a + holePoints(s, pack.course.pars[h], pack.course.sis[h], partner.daily), 0);
  const tally = card.tally[hole];
  const tPts = tally ? holePoints(tally, par, si, me.daily) : 0;

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/player">‹ Card</a>
        <div className="titles">
          <div className="t">{firstName(partner.name)}'s card</div>
          <div className="s">{pack.course.name} · Rd {pack.round} · {totalPts} pts</div>
        </div>
        <span />
      </div>
      <main>
        <div className="card">
          <div className="hole-head">
            <div className="hole-no num">{hole + 1}<small> / 18</small></div>
            <div className="hole-facts">
              Par <b className="num">{par}</b> · SI <b className="num">{si}</b><br />
              {pStrokes === 0 ? `no strokes for ${firstName(partner.name)}` : `${pStrokes} stroke${pStrokes > 1 ? "s" : ""} for ${firstName(partner.name)}`}
              {Array.from({ length: pStrokes }, (_, i) => <span className="strokes-dot" key={i} />)}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "14px 14px 10px" }}>
          <div className="label" style={{ textAlign: "center" }}>{partner.name} — gross score</div>
          <div className="stepper">
            <button className="step-btn" aria-label="one less" disabled={isWiped || shown <= 1} onClick={() => setPartner(shown - 1)}>−</button>
            {isWiped
              ? <div className="score-big wiped">WIPE</div>
              : <div className="score-big num" data-testid="score">{shown}</div>}
            <button className="step-btn" aria-label="one more" disabled={isWiped || shown >= 15} onClick={() => setPartner(shown + 1)}>+</button>
          </div>
          <div className="pts-line">
            {isWiped ? <b style={{ color: "var(--flag)" }}>0 points</b> : <>
              {score ? "" : "tap + / − to set · "}
              <b>{pPts} point{pPts === 1 ? "" : "s"}</b>
            </>}
          </div>
          <button className="wipe-btn" onClick={() => (isWiped ? setPartner(par) : setPartner(0))}>
            {isWiped ? "Un-wipe: back to scoring" : "Wipe (no score) ✕"}
          </button>
        </div>

        <div className="card tally-card">
          <div className="row">
            <span className="label">My score (optional) — {firstName(me.name)}</span>
            {tally > 0 && (
              <button className="tally-clear" onClick={() => setTally(0)} aria-label="clear my score">clear ✕</button>
            )}
          </div>
          <div className="row" style={{ justifyContent: "center", gap: 18, paddingTop: 4 }}>
            <button className="step-btn mini" aria-label="my score one less" disabled={!tally || tally <= 1} onClick={() => setTally(tally - 1)}>−</button>
            <div className="tally-value num" data-testid="tally">
              {tally ? (<>{tally}<sup className={`sup-pts ${tPts === 0 ? "zero" : ""}`}>{tPts}</sup></>) : "—"}
            </div>
            <button className="step-btn mini" aria-label="my score one more" disabled={tally >= 15} onClick={() => setTally(tally ? tally + 1 : par)}>+</button>
          </div>
          <p className="hint" style={{ textAlign: "center", margin: "4px 0 0" }}>
            Stays on your phone — check it against your marker's card before cards are submitted.
          </p>
        </div>

        <div className="card" style={{ padding: 9 }}>
          {[0, 9].map((off) => (
            <div className="holes-strip" style={{ marginBottom: off === 0 ? 4 : 0 }} key={off}>
              {Array.from({ length: 9 }, (_, i) => {
                const h = off + i;
                const s = card.scores[h];
                const hp = s ? holePoints(s, pack.course.pars[h], pack.course.sis[h], partner.daily) : 0;
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
            <button className="btn" onClick={() => { commitShownIfUntouched(); nav("/player/submit"); }} data-testid="finish-card">
              Review &amp; submit ✓
            </button>
          )}
        </div>
      </main>
    </>
  );
}
