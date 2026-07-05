import { useEffect, useState } from "react";
import { emptyPlayerCard, mutate, playerCardKey, useAppState } from "../../state/store";
import { nav } from "../../router";
import { Card, holePoints } from "../../engine";
import { onSyncStatus, pushCard, SyncStatus } from "./playerSync";
import { firstName } from "./PlayerHome";

/**
 * The marker reviews their playing partner's card — with the partner
 * looking over their shoulder, like signing a paper card — then presses
 * Submit. Only then does the card become official.
 */
export function SubmitRound() {
  const { player } = useAppState();
  const [sync, setSync] = useState<SyncStatus>("synced");
  useEffect(() => onSyncStatus(setSync), []);
  const pack = player.pack;
  const my = player.myIndex;
  const key = pack ? playerCardKey(pack.tripId, pack.round) : "";
  const card = (pack && player.cards[key]) || emptyPlayerCard();

  if (!pack || my == null || card.markIndex == null) {
    nav("/player");
    return null;
  }
  const me = pack.players[my];
  const partner = pack.players[card.markIndex];
  const submitted = card.submittedAt != null;
  const holesIn = card.scores.filter((s) => s > 0).length;
  const tallyIn = card.tally.filter((s) => s > 0).length;

  const submit = () => {
    if (holesIn < 18 &&
        !confirm(`${18 - holesIn} hole(s) are blank and will count as wipes (0 points). Submit anyway?`)) {
      return;
    }
    mutate((d) => {
      const c = d.player.cards[key];
      if (c) c.submittedAt = Date.now();
    });
    pushCard();
  };

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/player">‹ Card</a>
        <div className="titles">
          <div className="t">{submitted ? "Submitted card" : "Review & submit"}</div>
          <div className="s">Round {pack.round} · {pack.course.name}</div>
        </div>
        <span />
      </div>
      <main>
        <div className="card">
          <div className="label" style={{ marginBottom: 6 }}>
            {partner.name} — official card (marked by {firstName(me.name)})
          </div>
          <CardTable scores={card.scores} daily={partner.daily} pack={pack} testid="submit-total" />
          {holesIn < 18 && !submitted && (
            <p className="error-text" style={{ marginBottom: 0 }}>
              {18 - holesIn} hole(s) have no score — they'll count as wipes.
            </p>
          )}
        </div>

        {tallyIn > 0 && (
          <div className="card">
            <div className="label" style={{ marginBottom: 6 }}>
              My own tally — {me.name} (not submitted; compare with your marker)
            </div>
            <CardTable scores={card.tally} daily={me.daily} pack={pack} />
          </div>
        )}

        {submitted ? (
          <div className="card">
            <div className="row">
              <span className="p-name">
                Submitted {new Date(card.submittedAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                <div className="p-sub">Corrections after this point go through an organiser.</div>
              </span>
              {sync === "synced"
                ? <span className="chip ok">delivered ✓</span>
                : <span className="chip warn">delivering when there's signal…</span>}
            </div>
          </div>
        ) : (
          <>
            <button className="btn" onClick={submit} data-testid="submit-round">
              Submit {firstName(partner.name)}'s round
            </button>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => nav("/player/score")}>‹ Fix a score</button>
            </div>
            <p className="hint" style={{ padding: "0 6px" }}>
              Check it with {firstName(partner.name)} first — once submitted, the card
              locks on this phone and goes to the organisers.
            </p>
          </>
        )}
      </main>
    </>
  );
}

function CardTable({ scores, daily, pack, testid }: {
  scores: Card; daily: number;
  pack: NonNullable<ReturnType<typeof useAppState>["player"]["pack"]>;
  testid?: string;
}) {
  const pts = (from: number, to: number) =>
    scores.slice(from, to).reduce(
      (a, s, i) => a + holePoints(s, pack.course.pars[from + i], pack.course.sis[from + i], daily), 0);
  const gross = (from: number, to: number) =>
    scores.slice(from, to).reduce((a, b) => a + b, 0);

  return (
    <>
      {[0, 9].map((off) => (
        <table className="mini-table" key={off} style={{ marginBottom: 6 }}>
          <thead>
            <tr>
              <th>Hole</th>
              {Array.from({ length: 9 }, (_, i) => <th key={i} className="num">{off + i + 1}</th>)}
              <th>{off === 0 ? "Out" : "In"}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: "var(--ink-soft)" }}>Score</td>
              {Array.from({ length: 9 }, (_, i) => {
                const h = off + i;
                const s = scores[h];
                const hp = s ? holePoints(s, pack.course.pars[h], pack.course.sis[h], daily) : 0;
                return (
                  <td key={i} className="num">
                    {s ? (<>{s}<sup className={`sup-pts ${hp === 0 ? "zero" : ""}`}>{hp}</sup></>) : "·"}
                  </td>
                );
              })}
              <td className="num" style={{ fontWeight: 700 }}>
                {gross(off, off + 9) || "·"}<sup className="sup-pts">{pts(off, off + 9)}</sup>
              </td>
            </tr>
          </tbody>
        </table>
      ))}
      <div className="row" style={{ paddingTop: 2 }}>
        <span className="p-sub">Gross {gross(0, 18) || "—"}</span>
        <span className="p-pts num" data-testid={testid}>{pts(0, 18)} pts</span>
      </div>
    </>
  );
}
