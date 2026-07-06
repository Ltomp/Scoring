import { useEffect, useState } from "react";
import { emptyPlayerCard, mutate, playerCardKey, useAppState } from "../../state/store";
import { nav } from "../../router";
import { holePoints } from "../../engine";
import { onSyncStatus, SyncStatus } from "./playerSync";

export function PlayerHome() {
  const { player } = useAppState();
  const [sync, setSync] = useState<SyncStatus>("synced");
  useEffect(() => onSyncStatus(setSync), []);
  const pack = player.pack;

  if (!pack) {
    return (
      <Bar title="My scorecard">
        <div className="card">
          <div className="label">No round loaded</div>
          <p className="hint" style={{ fontSize: 13.5 }}>
            Ask a trip organiser for today's round link (or scan their QR code with
            your camera). It sets up today's cards — course, holes and daily
            handicaps — automatically.
          </p>
        </div>
      </Bar>
    );
  }

  const key = playerCardKey(pack.tripId, pack.round);
  const card = player.cards[key] ?? emptyPlayerCard();
  const my = player.myIndex;

  if (my == null) {
    return (
      <Bar title="Who are you?" sub={`${pack.tripName} · Round ${pack.round}`}>
        <div className="card divided">
          {pack.players.map((p, i) => (
            <div className="row" key={i}>
              <span className="p-name">{p.name}</span>
              <button className="btn small" onClick={() => mutate((d) => { d.player.myIndex = i; })}>
                That's me
              </button>
            </div>
          ))}
        </div>
        <p className="hint">Pick your own name first — then you'll choose whose card you're marking.</p>
      </Bar>
    );
  }

  const me = pack.players[my];

  if (card.markIndex == null) {
    return (
      <Bar title="Whose card are you marking?" sub={`Round ${pack.round} · you are ${firstName(me.name)}`}>
        <div className="card divided">
          {pack.players.map((p, i) =>
            i === my ? null : (
              <div className="row" key={i}>
                <span className="p-name">{p.name} <span className="p-sub num">daily h'cap {p.daily}</span></span>
                <button
                  className="btn small"
                  data-testid={`mark-${i}`}
                  onClick={() => mutate((d) => {
                    const c = d.player.cards[key] ?? emptyPlayerCard();
                    c.markIndex = i;
                    d.player.cards[key] = c;
                  })}
                >
                  Marking them
                </button>
              </div>
            ),
          )}
        </div>
        <p className="hint">
          Like on paper: you keep your playing partner's official card, and they keep
          yours. You can pencil in your own score too as you go, to check against
          what your marker has for you before cards are submitted.
        </p>
      </Bar>
    );
  }

  const partner = pack.players[card.markIndex];
  const done = card.scores.filter((s) => s > 0).length;
  const firstOpen = card.scores.findIndex((s) => !s);
  const partnerPts = card.scores.reduce(
    (a, s, h) => a + holePoints(s, pack.course.pars[h], pack.course.sis[h], partner.daily), 0);
  const tallyHoles = card.tally.filter((s) => s > 0).length;
  const tallyPts = card.tally.reduce(
    (a, s, h) => a + holePoints(s, pack.course.pars[h], pack.course.sis[h], me.daily), 0);
  const submitted = card.submittedAt != null;

  const syncChip = submitted
    ? (sync === "synced" ? <span className="chip ok">submitted ✓</span> : <span className="chip warn">submitting…</span>)
    : sync === "synced" ? <span className="chip ok">draft synced</span>
    : sync === "pending" ? <span className="chip warn">syncing…</span>
    : sync === "offline" ? <span className="chip mute">offline — will sync</span>
    : <span className="chip mute">no drop-box</span>;

  return (
    <Bar title={`G'day, ${firstName(me.name)}`} sub={`${pack.tripName} · Round ${pack.round}`} chip={syncChip}>
      <div className="card hero">
        <div className="label">Today</div>
        <div className="big">{pack.course.name}</div>
        <div className="meta">
          Marking <b>{firstName(partner.name)}</b> (h'cap {partner.daily}) · your h'cap <b>{me.daily}</b>
        </div>
      </div>
      <div className="card stat-row">
        <div className="stat"><div className="v num">{done}</div><div className="k">{firstName(partner.name)} holes</div></div>
        <div className="stat"><div className="v num">{partnerPts}</div><div className="k">{firstName(partner.name)} pts</div></div>
        <div className="stat"><div className="v num">{tallyHoles ? tallyPts : "—"}</div><div className="k">My tally</div></div>
      </div>
      <button className="btn small ghost" onClick={() => nav("/player/mine")} data-testid="review-mine">
        Review my scores (read-only)
      </button>
      {submitted ? (
        <>
          <div className="card">
            <div className="label">Card submitted</div>
            <p className="hint" style={{ fontSize: 13.5 }}>
              {firstName(partner.name)}'s card is in with the organisers
              {sync !== "synced" ? " (delivering as soon as there's signal)" : ""}. Need a
              correction? Ask an organiser — they can amend it.
            </p>
          </div>
          <button className="btn ghost" onClick={() => nav("/player/submit")}>Review submitted card</button>
        </>
      ) : (
        <>
          <button className="btn" onClick={() => nav("/player/score")} data-testid="open-card">
            {done === 0 ? `Start ${firstName(partner.name)}'s card — hole 1 ›`
              : done === 18 ? "Review the card"
              : `Continue — hole ${firstOpen + 1} ›`}
          </button>
          <button className="btn ghost" onClick={() => nav("/player/submit")} data-testid="review-submit">
            Review &amp; submit round
          </button>
        </>
      )}
      <div className="row" style={{ padding: "0 4px" }}>
        <p className="hint">
          {submitted
            ? "See you on the tee tomorrow."
            : "Nothing is final until you press Submit — fix mistakes any time before that."}
        </p>
        {!submitted && (
          <button
            className="btn small ghost"
            onClick={() => {
              if (confirm(`Change who you're marking? ${firstName(partner.name)}'s scores entered so far will be cleared.`))
                mutate((d) => {
                  const c = d.player.cards[key];
                  if (c) { c.markIndex = null; c.scores = Array(18).fill(0); }
                });
            }}
          >
            Change partner
          </button>
        )}
      </div>
    </Bar>
  );
}

function Bar({ title, sub, chip, children }: {
  title: string; sub?: string; chip?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <>
      <div className="appbar">
        <a className="back" href="#/">‹ Home</a>
        <div className="titles">
          <div className="t">{title}</div>
          {sub && <div className="s">{sub}</div>}
        </div>
        {chip ?? <span />}
      </div>
      <main>{children}</main>
    </>
  );
}

export function firstName(n: string): string {
  const nick = n.split(",")[1]?.trim();
  return nick || n.split(" ")[0];
}
