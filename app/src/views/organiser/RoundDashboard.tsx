import { useEffect, useState } from "react";
import { CardSource, mutate, Trip, useAppState } from "../../state/store";
import { nav } from "../../router";
import { HOLES, RoundResult } from "../../engine";
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
            rd.cardMeta[row.player] = { source: "sync", updatedAt: remoteAt, final: row.done };
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

  const drafts = r.cardMeta.filter((m) => m && m.source === "sync" && !m.final).length;
  const setCompleted = async (completed: boolean) => {
    if (completed) {
      const warnings = [
        received < trip.players.length
          ? `${trip.players.length - received} player(s) have no card — they'll be scored as absent (field average).`
          : "",
        drafts > 0 ? `${drafts} card(s) are still drafts — the marker hasn't pressed Submit.` : "",
      ].filter(Boolean);
      if (warnings.length && !confirm(`${warnings.join("\n")}\nComplete the round?`)) return;
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

      <DeskGrid trip={trip} round={round} rr={rr} daily={daily} />

      <div className="card divided mobile-only" data-testid="card-list">
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
                      ? `${rr.raw[i]} pts · ${holes}/18 holes`
                      : r.completed ? `absent · avg ${rr.avg}` : "waiting…"}
                  </div>
                </span>
                {r.penalties[i] > 0 && <span className="chip pen">pen {r.penalties[i]}</span>}
                <StatusChip meta={meta} hasCard={!!card} completed={r.completed} />
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

/** Laptop view: the whole field keyed like the workbook's scoring sheet. */
function DeskGrid({ trip, round, rr, daily }: {
  trip: Trip; round: number; rr: RoundResult; daily: number[];
}) {
  const r = trip.rounds[round - 1];
  const course = r.course!;
  const locked = r.completed;

  const setScore = (p: number, h: number, v: string) => {
    const n = Number(v);
    const s = Number.isInteger(n) && n >= 1 && n <= 15 ? n : 0;
    mutate((d) => {
      const rd = d.trips.find((x) => x.id === trip.id)!.rounds[round - 1];
      const card = rd.cards[p] ? [...rd.cards[p]!] : Array(HOLES).fill(0);
      card[h] = s;
      rd.cards[p] = card;
      rd.cardMeta[p] = { source: "manual", updatedAt: Date.now() };
    });
  };
  const gross = (p: number, from: number, to: number) => {
    const card = r.cards[p];
    if (!card) return "";
    const sum = card.slice(from, to).reduce((a, b) => a + b, 0);
    return sum || "";
  };

  return (
    <div className="card desk-only" style={{ padding: 10 }}>
      <div className="sheet">
        <table data-testid="desk-grid">
          <thead>
            <tr>
              <th>Player</th><th>HC</th>
              {course.pars.map((_, h) => <th key={h} className="num">{h + 1}</th>)}
              <th>Out</th><th>In</th><th>Gross</th><th>Pts</th><th>Pen</th><th>Status</th>
            </tr>
            <tr className="facts">
              <th style={{ textAlign: "left" }}>Par {course.pars.reduce((a, b) => a + b, 0)}</th><th />
              {course.pars.map((p, h) => <th key={h} className="num">{p}</th>)}
              <th colSpan={6} />
            </tr>
            <tr className="facts">
              <th style={{ textAlign: "left" }}>SI</th><th />
              {course.sis.map((s, h) => <th key={h} className="num">{s}</th>)}
              <th colSpan={6} />
            </tr>
          </thead>
          <tbody>
            {trip.players.map((p, i) => {
              const meta = r.cardMeta[i];
              const card = r.cards[i];
              return (
                <tr key={i}>
                  <td className="name">{p.name}</td>
                  <td className="num" data-testid={`dg-hc-${i}`}>{daily[i]}</td>
                  {course.pars.map((_, h) => (
                    <td key={h} className="scorecell">
                      <input
                        aria-label={`${p.name} hole ${h + 1}`}
                        inputMode="numeric"
                        disabled={locked}
                        value={card?.[h] || ""}
                        placeholder="·"
                        onChange={(e) => setScore(i, h, e.target.value)}
                        data-testid={`dg-${i}-${h}`}
                      />
                      {card?.[h] ? (
                        <span className={`pts-sup num ${rr.pts[i][h] === 0 ? "zero" : ""}`} aria-hidden="true">
                          {rr.pts[i][h]}
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td className="sum num">{gross(i, 0, 9)}</td>
                  <td className="sum num">{gross(i, 9, 18)}</td>
                  <td className="sum num">{gross(i, 0, 18)}</td>
                  <td className="sum num" data-testid={`dg-pts-${i}`}>{card ? rr.raw[i] : locked ? rr.avg : ""}</td>
                  <td style={{ padding: 1 }}>
                    {locked
                      ? (r.penalties[i] ? `−${r.penalties[i]}` : "")
                      : <PenaltyPicker trip={trip} round={round} player={i} tid={`dg-pen-${i}`} />}
                  </td>
                  <td>
                    <StatusChip meta={meta} hasCard={!!card} completed={locked} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ marginBottom: 0 }}>
        Type straight into the grid to key a paper card — keyed cards beat auto-synced
        ones. Blank cell = wipe (0 points).
      </p>
    </div>
  );
}

function StatusChip({ meta, hasCard, completed }: {
  meta: { source: CardSource; final?: boolean } | null; hasCard: boolean; completed: boolean;
}) {
  if (!hasCard) return <span className="chip mute">{completed ? "absent" : "waiting"}</span>;
  if (meta?.source === "manual") return <span className="chip ok">keyed</span>;
  if (meta?.source === "link") return <span className="chip ok">imported</span>;
  return meta?.final
    ? <span className="chip ok">submitted ✓</span>
    : <span className="chip warn">draft</span>;
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

function PenaltyPicker({ trip, round, player, tid }: { trip: Trip; round: number; player: number; tid?: string }) {
  const v = trip.rounds[round - 1].penalties[player];
  return (
    <select
      aria-label="card penalty"
      value={v}
      style={{ width: 86, padding: "6px 8px", fontSize: 12.5 }}
      onChange={(e) => mutate((d) => {
        d.trips.find((x) => x.id === trip.id)!.rounds[round - 1].penalties[player] = Number(e.target.value);
      })}
      data-testid={tid ?? `penalty-${player}`}
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
