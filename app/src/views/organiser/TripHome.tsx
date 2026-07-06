import { useEffect, useState } from "react";
import { mutate, Trip, useAppState } from "../../state/store";
import { nav } from "../../router";
import { tiedOnNet } from "../../engine";
import { computableRounds, lastActiveRound, orgCompute } from "./orgCompute";
import { firstName } from "../player/PlayerHome";
import { onTripSyncStatus, pullTripMeta, pushTripMeta, TripSyncStatus } from "../../state/tripSync";
import { fetchAndMergeAllCards } from "../../state/cardSync";

export function TripHome({ trip }: { trip: Trip }) {
  useAppState();
  const [sync, setSync] = useState<TripSyncStatus>("synced");
  const upTo = lastActiveRound(trip);
  const res = upTo > 0 ? orgCompute(trip, upTo) : null;
  const nRounds = computableRounds(trip);

  useEffect(() => onTripSyncStatus((id, s) => { if (id === trip.id) setSync(s); }), [trip.id]);

  // pull the latest roster/courses/penalties/cards on open, and keep refreshing
  // while this screen is up, so another device's edits show up here too
  useEffect(() => {
    if (!trip.dropbox) return;
    let stop = false;
    const pull = async () => {
      try {
        await pullTripMeta(trip.id);
        await fetchAndMergeAllCards(trip);
        // also push: a trip opened here but never edited since getting a
        // drop-box (or predating trip-state syncing entirely) would otherwise
        // never get a gts_trip_state row, so #/org's auto-discovery could
        // never hydrate it on another device. Harmless no-op once it exists.
        pushTripMeta(trip.id);
      } catch { /* stays on last-known-good state; will retry */ }
    };
    void pull();
    const id = setInterval(() => { if (!stop) void pull(); }, 12000);
    return () => { stop = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.id, !!trip.dropbox]);

  const order = res
    ? trip.players.map((_, i) => i).sort((a, b) => res.overallPos[a] - res.overallPos[b])
    : [];

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/org">‹ Trips</a>
        <div className="titles">
          <div className="t">{trip.name} {trip.year}</div>
          <div className="s">{trip.players.length} players · {upTo}/{trip.rounds.length || 0} rounds played</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {trip.dropbox && (
            sync === "synced" ? <span className="chip ok">synced ✓</span>
            : sync === "offline" ? <span className="chip mute">offline</span>
            : <span className="chip warn">syncing…</span>
          )}
          <button className="btn small ghost" onClick={() => nav(`/org/t/${trip.id}/setup`)}>Setup</button>
        </div>
      </div>
      <main>
        {res && order.length > 0 && (
          <div className="card hero">
            <div className="row">
              <div>
                <div className="label">Leader after round {upTo}</div>
                <div className="big">{firstName(trip.players[order[0]].name)} · {res.totals[order[0]]} pts</div>
                <div className="meta">
                  {order[1] !== undefined ? `${res.totals[order[0]] - res.totals[order[1]]} clear of ${firstName(trip.players[order[1]].name)}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 32 }}>🏆</div>
            </div>
          </div>
        )}

        <div className="desk-2col">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="label" style={{ padding: "4px 6px 0" }}>Rounds</div>
        {trip.rounds.map((r, i) => (
          <button key={i} className="card row" style={{ width: "100%", textAlign: "left" }} onClick={() => nav(`/org/t/${trip.id}/r/${i + 1}`)}>
            <span className="p-name">
              Round {i + 1} <span className="p-sub">{r.course?.name ?? "no course yet"}</span>
              <div className="p-sub">
                {r.cards.filter(Boolean).length}/{trip.players.length} cards
              </div>
            </span>
            {r.completed ? <span className="chip ok">completed ✓</span> : r.cards.some(Boolean) ? <span className="chip warn">in progress</span> : <span className="chip mute">not started</span>}
          </button>
        ))}
        {trip.rounds.length === 0 && (
          <div className="card hint">Add rounds and courses in Setup, then share each morning's round pack from the round screen.</div>
        )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {res && (
          <>
            <div className="label" style={{ padding: "4px 6px 0" }}>Trip leaderboard</div>
            <div className="card divided" data-testid="leaderboard">
              {order.map((p) => (
                <div className="row" key={p}>
                  <span className="pos-num num">{res.overallPos[p]}</span>
                  <span className="p-name">
                    {trip.players[p].name}{" "}
                    <span className="p-sub num">
                      {trip.rounds.slice(0, upTo).map((_, r) => res.rounds[r]?.net[p] ?? "—").join(" · ")}
                    </span>
                    {res.rounds[upTo - 1] && tiedOnNet(res.totals, p) && <span className="chip warn">cb</span>}
                  </span>
                  <span className="p-pts num">{res.totals[p]}</span>
                </div>
              ))}
            </div>
            <div className="card divided">
              <div className="label" style={{ paddingBottom: 4 }}>Handicaps (into next round)</div>
              {trip.players.map((p, i) => (
                <div className="row" key={i}>
                  <span className="p-name">{p.name}</span>
                  <span className="p-sub num">start {p.hcap}</span>
                  <span className="p-pts num" style={{ fontSize: 14 }}>{fmtHc(res.endHc[i])}</span>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
        </div>

        {!trip.dropbox && (
          <p className="hint" style={{ padding: "0 6px" }}>
            No drop-box on this trip, so it only lives on this device — use Backup/Restore
            below to move it, or connect one from Setup to get auto-sync and access from
            other devices.
          </p>
        )}

        <div className="btn-row">
          <button className="btn ghost" onClick={() => backup(trip)}>Backup trip (JSON)</button>
          <button
            className="btn ghost"
            onClick={() => {
              mutate((d) => { d.trips.find((t) => t.id === trip.id)!.archived = !trip.archived; });
              pushTripMeta(trip.id);
            }}
          >
            {trip.archived ? "Unarchive" : "Archive trip"}
          </button>
        </div>
        {nRounds < trip.rounds.length && (
          <p className="hint">Some rounds still need a course before they can be scored.</p>
        )}
      </main>
    </>
  );
}

function fmtHc(h: number): string {
  return (Math.round(h * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
}

function backup(trip: Trip): void {
  const blob = new Blob([JSON.stringify(trip, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(trip.name || "trip").replace(/\W+/g, "-")}-${trip.year}-backup.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
