import { useState } from "react";
import { Trip, useAppState } from "../../state/store";
import { nav } from "../../router";
import { adjustment, tiedOnNet } from "../../engine";
import { orgCompute } from "./orgCompute";

export function Results({ trip, round }: { trip: Trip; round: number }) {
  useAppState();
  const [tab, setTab] = useState<"daily" | "hcap">("daily");
  const [shared, setShared] = useState(false);
  const res = orgCompute(trip, round);
  const r = trip.rounds[round - 1];
  if (!res || !r?.course) { nav(`/org/t/${trip.id}`); return null; }

  const rr = res.rounds[round - 1];
  const n = trip.players.length;
  const anyPlayed = rr.played.some(Boolean);
  const order = trip.players.map((_, i) => i).sort((a, b) => rr.pos[a] - rr.pos[b]);

  const snapshot = [
    `⛳ ${trip.name} ${trip.year} — Round ${round} (${r.course.name})`,
    ...order.map((p) => {
      const bits = [`${rr.pos[p]}. ${trip.players[p].name} — ${rr.net[p]} pts`];
      if (!rr.played[p]) bits.push("(absent, field avg)");
      if (r.penalties[p] > 0 && rr.played[p]) bits.push(`(pen −${r.penalties[p]})`);
      if (rr.played[p] && tiedOnNet(rr.net, p)) bits.push("(cb)");
      return bits.join(" ");
    }),
  ].join("\n");

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: snapshot });
      else await navigator.clipboard.writeText(snapshot);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* user cancelled */ }
  };

  return (
    <>
      <div className="appbar">
        <a className="back" href={`#/org/t/${trip.id}/r/${round}`}>‹ Round {round}</a>
        <div className="titles">
          <div className="t">Round {round} results</div>
          <div className="s">{r.course.name} · Australian countback</div>
        </div>
        <span />
      </div>
      <main>
        <div className="seg">
          <button className={tab === "daily" ? "on" : ""} onClick={() => setTab("daily")}>Daily comp</button>
          <button className={tab === "hcap" ? "on" : ""} onClick={() => setTab("hcap")}>Handicaps</button>
        </div>

        {tab === "daily" ? (
          <div className="card divided" data-testid="daily-results">
            {order.map((p) => (
              <div className="row" key={p}>
                <span className="pos-num num">{rr.pos[p]}</span>
                <span className="p-name">
                  {trip.players[p].name}{" "}
                  <span className="p-sub num">
                    {rr.played[p]
                      ? `${rr.raw[p]} pts${r.penalties[p] ? ` − ${r.penalties[p]} pen` : ""}`
                      : `absent · field avg`}
                  </span>
                  {rr.played[p] && tiedOnNet(rr.net, p) && <span className="chip warn">cb</span>}
                  {r.penalties[p] > 0 && rr.played[p] && <span className="chip pen">pen</span>}
                </span>
                <span className="p-pts num" data-testid={`net-${p}`}>{rr.net[p]}</span>
                <span className={`hc-move num ${adjustment(rr.pos[p], n) < 0 ? "down" : "up"}`}>
                  {anyPlayed ? fmtAdj(adjustment(rr.pos[p], n)) : "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card divided">
            {trip.players.map((p, i) => {
              const into = res.hcInto[round - 1][i];
              const after = anyPlayed ? into + adjustment(rr.pos[i], n) : into;
              return (
                <div className="row" key={i}>
                  <span className="p-name">{p.name} <span className="p-sub num">daily {res.daily[round - 1][i]}</span></span>
                  <span className="p-sub num">{fmt(into)} →</span>
                  <span className="p-pts num" style={{ fontSize: 14 }}>{fmt(after)}</span>
                </div>
              );
            })}
          </div>
        )}

        <button className="btn" onClick={share}>{shared ? "Shared ✓" : "Share results snapshot to group chat"}</button>
        {!r.completed && <p className="hint">Round not completed yet — results move as cards come in.</p>}
      </main>
    </>
  );
}

function fmt(h: number): string {
  return String(Math.round(h * 100) / 100);
}
function fmtAdj(a: number): string {
  return a < 0 ? fmt(a) : `+${fmt(a)}`;
}
