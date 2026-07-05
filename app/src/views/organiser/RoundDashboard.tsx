import { useEffect, useState } from "react";
import { mutate, Trip, useAppState } from "../../state/store";
import { nav } from "../../router";
import { HOLES } from "../../engine";
import { shareUrl } from "../../share/codec";
import { completeRound, fetchCards } from "../../sync/dropbox";
import { ShareSheet } from "../../components/ShareSheet";
import { orgCompute } from "./orgCompute";

export function RoundDashboard({ trip, round }: { trip: Trip; round: number }) {
  useAppState();
  const r = trip.rounds[round - 1];
  const [showPack, setShowPack] = useState(false);
  const [manualFor, setManualFor] = useState<number | null>(null);
  const [pollErr, setPollErr] = useState("");

  // collect cards from the drop-box while the round is open
  useEffect(() => {
    if (!trip.dropbox || !r || r.completed) return;
    let stop = false;
    const poll = async () => {
      try {
        const rows = await fetchCards(trip.dropbox!, trip.id, trip.readKey, round);
        if (stop) return;
        setPollErr("");
        mutate((d) => {
          const t = d.trips.find((x) => x.id === trip.id)!;
          const rd = t.rounds[round - 1];
          if (!rd || rd.completed) return;
          for (const row of rows) {
            if (row.player >= t.players.length) continue;
            const meta = rd.cardMeta[row.player];
            if (meta?.source === "manual") continue; // organiser corrections win
            const remoteAt = Date.parse(row.updated_at);
            if (meta && meta.source !== "sync" && meta.updatedAt >= remoteAt) continue;
            rd.cards[row.player] = row.scores;
            rd.cardMeta[row.player] = { source: "sync", updatedAt: remoteAt };
          }
        });
      } catch (e) {
        if (!stop) setPollErr(e instanceof Error ? e.message : String(e));
      }
    };
    void poll();
    const id = setInterval(poll, 8000);
    return () => { stop = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, round, r?.completed, !!trip.dropbox]);

  if (!r) { nav(`/org/t/${trip.id}`); return null; }

  if (!r.course) {
    return (
      <Shell trip={trip} round={round}>
        <div className="card hint">This round has no course yet — add it in Setup first.</div>
        <button className="btn" onClick={() => nav(`/org/t/${trip.id}/setup`)}>Go to Setup</button>
      </Shell>
    );
  }

  const res = orgCompute(trip, round)!;
  const daily = res.daily[round - 1];
  const rr = res.rounds[round - 1];
  const received = r.cards.filter(Boolean).length;

  const packUrl = shareUrl({
    v: 1, kind: "pack", tripId: trip.id, tripName: trip.name || "Golf Trip",
    round, course: r.course,
    players: trip.players.map((p, i) => ({ name: p.name, daily: daily[i] })),
    dropbox: trip.dropbox ? { ...trip.dropbox, writeKey: trip.writeKey } : null,
  });

  const setCompleted = async (completed: boolean) => {
    if (completed && received < trip.players.length &&
        !confirm(`${trip.players.length - received} player(s) have no card — they'll be scored as absent (field average). Complete the round?`)) {
      return;
    }
    mutate((d) => { d.trips.find((x) => x.id === trip.id)!.rounds[round - 1].completed = completed; });
    if (trip.dropbox) {
      try { await completeRound(trip.dropbox, trip.id, trip.readKey, round, completed); }
      catch { /* local completion still stands; uploads stay blocked next poll */ }
    }
    if (completed) nav(`/org/t/${trip.id}/r/${round}/results`);
  };

  return (
    <Shell trip={trip} round={round}>
      <div className="row" style={{ padding: "0 2px" }}>
        <span className="p-name">{r.course.name} <span className="p-sub">cards {received}/{trip.players.length}{trip.dropbox ? " · auto-collecting" : ""}</span></span>
        <button className="btn small" onClick={() => setShowPack(!showPack)} data-testid="share-pack">
          {showPack ? "Hide round pack" : "Share round pack"}
        </button>
      </div>
      {pollErr && <p className="error-text" style={{ padding: "0 4px" }}>Drop-box unreachable: {pollErr}</p>}
      {showPack && (
        <ShareSheet
          url={packUrl}
          title={`${trip.name} — Round ${round}`}
          qrLabel="Players scan this each morning"
        />
      )}

      <div className="card divided" data-testid="card-list">
        {trip.players.map((p, i) => {
          const card = r.cards[i];
          const meta = r.cardMeta[i];
          const holes = card ? card.filter((s) => s > 0).length : 0;
          return (
            <div className="row prow" key={i}>
              <div className="row" style={{ width: "100%" }}>
                <span className="p-name">
                  {p.name}
                  <div className="p-sub num">
                    {card
                      ? `${rr.raw[i]} pts · ${holes}/18 holes${meta?.source === "manual" ? " · keyed" : meta?.source === "link" ? " · QR" : ""}`
                      : r.completed ? `absent · avg ${rr.avg}` : "waiting…"}
                  </div>
                </span>
                {r.penalties[i] > 0 && <span className="chip pen">pen {r.penalties[i]}</span>}
                {card ? <span className="chip ok">in</span> : <span className="chip mute">{r.completed ? "absent" : "waiting"}</span>}
              </div>
              {!r.completed && (
                <div className="row" style={{ width: "100%", justifyContent: "flex-end" }}>
                  <PenaltyPicker trip={trip} round={round} player={i} />
                  <button className="btn small ghost" onClick={() => setManualFor(manualFor === i ? null : i)}>
                    {card ? "edit card" : "key card"}
                  </button>
                </div>
              )}
              {manualFor === i && !r.completed && (
                <ManualCard trip={trip} round={round} player={i} onDone={() => setManualFor(null)} />
              )}
            </div>
          );
        })}
      </div>

      {r.completed ? (
        <div className="btn-row">
          <button className="btn" onClick={() => nav(`/org/t/${trip.id}/r/${round}/results`)} data-testid="view-results">Results ›</button>
          <button className="btn ghost" onClick={() => setCompleted(false)}>Reopen round</button>
        </div>
      ) : (
        <button className="btn" onClick={() => setCompleted(true)} data-testid="complete-round">
          Complete round — lock cards & rank
        </button>
      )}
    </Shell>
  );
}

function Shell({ trip, round, children }: { trip: Trip; round: number; children: React.ReactNode }) {
  return (
    <>
      <div className="appbar">
        <a className="back" href={`#/org/t/${trip.id}`}>‹ {trip.name || "Trip"}</a>
        <div className="titles"><div className="t">Round {round}</div><div className="s">Organiser</div></div>
        <span />
      </div>
      <main>{children}</main>
    </>
  );
}

function PenaltyPicker({ trip, round, player }: { trip: Trip; round: number; player: number }) {
  const v = trip.rounds[round - 1].penalties[player];
  return (
    <select
      aria-label="card penalty"
      value={v}
      style={{ width: 86, padding: "6px 8px", fontSize: 12.5 }}
      onChange={(e) => mutate((d) => {
        d.trips.find((x) => x.id === trip.id)!.rounds[round - 1].penalties[player] = Number(e.target.value);
      })}
      data-testid={`penalty-${player}`}
    >
      <option value={0}>pen 0</option>
      <option value={1}>pen −1</option>
      <option value={2}>pen −2</option>
    </select>
  );
}

function ManualCard({ trip, round, player, onDone }: { trip: Trip; round: number; player: number; onDone: () => void }) {
  const r = trip.rounds[round - 1];
  const [vals, setVals] = useState<string[]>(
    () => (r.cards[player] ?? Array(HOLES).fill(0)).map((s) => (s ? String(s) : "")),
  );
  const save = () => {
    const scores = vals.map((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 15 ? n : 0;
    });
    mutate((d) => {
      const rd = d.trips.find((x) => x.id === trip.id)!.rounds[round - 1];
      rd.cards[player] = scores;
      rd.cardMeta[player] = { source: "manual", updatedAt: Date.now() };
    });
    onDone();
  };
  return (
    <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 8, paddingTop: 6 }}>
      <div className="hole-grid">
        {vals.map((v, h) => (
          <label className="cell" key={h}>
            <span className="num">{h + 1} · par {r.course!.pars[h]}</span>
            <input
              inputMode="numeric"
              value={v}
              placeholder="—"
              onChange={(e) => setVals(vals.map((x, i) => (i === h ? e.target.value : x)))}
              data-testid={`mc-${player}-${h}`}
            />
          </label>
        ))}
      </div>
      <p className="hint">Blank = wipe (0 points). Keyed cards beat auto-synced ones.</p>
      <div className="btn-row">
        <button className="btn small ghost" onClick={onDone}>Cancel</button>
        <button className="btn small" onClick={save} data-testid={`mc-save-${player}`}>Save card</button>
      </div>
    </div>
  );
}
