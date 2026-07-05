import { useEffect, useState } from "react";
import { mutate, playerCardKey, useAppState } from "../../state/store";
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
      <>
        <div className="appbar">
          <a className="back" href="#/">‹ Home</a>
          <div className="titles"><div className="t">My scorecard</div></div>
          <span />
        </div>
        <main>
          <div className="card">
            <div className="label">No round loaded</div>
            <p className="hint" style={{ fontSize: 13.5 }}>
              Ask a trip organiser for today's round link (or scan their QR code with
              your camera). It sets up your card — course, holes and your daily
              handicap — automatically.
            </p>
          </div>
        </main>
      </>
    );
  }

  const key = playerCardKey(pack.tripId, pack.round);
  const card = player.cards[key];
  const my = player.myIndex;

  if (my == null) {
    return (
      <>
        <div className="appbar">
          <a className="back" href="#/">‹ Home</a>
          <div className="titles">
            <div className="t">Who are you?</div>
            <div className="s">{pack.tripName} · Round {pack.round}</div>
          </div>
          <span />
        </div>
        <main>
          <div className="card divided">
            {pack.players.map((p, i) => (
              <div className="row" key={i}>
                <span className="p-name">{p.name}</span>
                <button
                  className="btn small"
                  onClick={() => mutate((d) => { d.player.myIndex = i; })}
                >
                  That's me
                </button>
              </div>
            ))}
          </div>
          <p className="hint">Pick your own name — your card only ever holds your scores.</p>
        </main>
      </>
    );
  }

  const me = pack.players[my];
  const scores = card?.scores ?? [];
  const done = scores.filter((s) => s > 0).length;
  const firstOpen = scores.findIndex((s) => !s);
  const pts = scores.reduce(
    (a, s, h) => a + holePoints(s, pack.course.pars[h], pack.course.sis[h], me.daily),
    0,
  );
  const syncChip =
    sync === "synced" ? <span className="chip ok">card synced ✓</span>
    : sync === "pending" ? <span className="chip warn">syncing…</span>
    : sync === "offline" ? <span className="chip mute">offline — will sync</span>
    : <span className="chip mute">hand-in only</span>;

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/">‹ Home</a>
        <div className="titles">
          <div className="t">G'day, {firstName(me.name)}</div>
          <div className="s">{pack.tripName} · Round {pack.round}</div>
        </div>
        {syncChip}
      </div>
      <main>
        <div className="card hero">
          <div className="label">Today</div>
          <div className="big">{pack.course.name}</div>
          <div className="meta">
            Par {pack.course.pars.reduce((a, b) => a + b, 0)} · Daily h'cap <b>{me.daily}</b>
          </div>
        </div>
        <div className="card stat-row">
          <div className="stat"><div className="v num">{done}</div><div className="k">Holes done</div></div>
          <div className="stat"><div className="v num">{pts}</div><div className="k">My points</div></div>
        </div>
        <button className="btn" onClick={() => nav("/player/score")}>
          {done === 0 ? "Start my card — hole 1 ›" : done === 18 ? "Review my card" : `Continue my card — hole ${firstOpen + 1} ›`}
        </button>
        <button className="btn ghost" onClick={() => nav("/player/handin")}>
          Hand in card (QR / link)
        </button>
        <div className="row" style={{ padding: "0 4px" }}>
          <p className="hint">
            Scores upload automatically when there's signal — the QR hand-in is the backup.
            Only organisers can see the comp.
          </p>
          <button
            className="btn small ghost"
            onClick={() => { if (confirm("Switch player? Your scores stay on this phone.")) mutate((d) => { d.player.myIndex = null; }); }}
          >
            Not {firstName(me.name)}?
          </button>
        </div>
      </main>
    </>
  );
}

export function firstName(n: string): string {
  const nick = n.split(",")[1]?.trim();
  return nick || n.split(" ")[0];
}
