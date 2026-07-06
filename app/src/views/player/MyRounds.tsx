import { useEffect, useState } from "react";
import { playerCardKey, useAppState } from "../../state/store";
import { nav } from "../../router";
import { Course, holePoints } from "../../engine";
import { fetchOwnCard, RemoteOwnCard } from "../../sync/dropbox";

/**
 * Read-only history of every round this player has a card for on this trip
 * (round 1 through the current round). Scores are always fetched fresh from
 * the drop-box, so an organiser's correction after the fact still shows up
 * here. Course + this player's daily h'cap for a round are only known if
 * this device has actually opened that round's pack at some point — that
 * context is cached locally (`roundHistory`), never persisted remotely, so
 * a round opened only on a different device shows its gross total but no
 * points breakdown.
 */
interface RoundRow {
  round: number;
  remote: RemoteOwnCard | null;
  loading: boolean;
  error: string;
}

export function MyRounds() {
  const { player } = useAppState();
  const pack = player.pack;
  const my = player.myIndex;
  const [rows, setRows] = useState<RoundRow[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!pack || my == null || !pack.dropbox) return;
    const dropbox = pack.dropbox;
    const rounds = Array.from({ length: pack.round }, (_, i) => i + 1);
    setRows(rounds.map((round) => ({ round, remote: null, loading: true, error: "" })));
    let cancelled = false;
    Promise.all(
      rounds.map((round) =>
        fetchOwnCard(dropbox, pack.tripId, dropbox.writeKey, round, my)
          .then((remote) => ({ round, remote, error: "" }))
          .catch((e) => ({ round, remote: null as RemoteOwnCard | null, error: e instanceof Error ? e.message : String(e) })),
      ),
    ).then((results) => {
      if (cancelled) return;
      setRows(results.map((r) => ({ round: r.round, remote: r.remote, loading: false, error: r.error })));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack?.tripId, pack?.round, my]);

  if (!pack || my == null) { nav("/player"); return null; }

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/player">‹ Card</a>
        <div className="titles">
          <div className="t">My rounds</div>
          <div className="s">{pack.tripName}</div>
        </div>
        <span />
      </div>
      <main>
        {!pack.dropbox && (
          <div className="card">
            <div className="label">No drop-box on this trip</div>
            <p className="hint" style={{ fontSize: 13.5 }}>
              There's nothing to check remotely without one — ask your organiser how
              your rounds are looking.
            </p>
          </div>
        )}
        {pack.dropbox && rows.length === 0 && <div className="card hint">Checking…</div>}
        {rows.map((row) => (
          <RoundRowView
            key={row.round}
            row={row}
            my={my}
            tripId={pack.tripId}
            isCurrent={row.round === pack.round}
            expanded={expanded === row.round}
            onToggle={() => setExpanded((e) => (e === row.round ? null : row.round))}
          />
        ))}
      </main>
    </>
  );
}

function RoundRowView({ row, my, tripId, isCurrent, expanded, onToggle }: {
  row: RoundRow; my: number; tripId: string; isCurrent: boolean; expanded: boolean; onToggle: () => void;
}) {
  const { player } = useAppState();
  const { round, remote, loading, error } = row;
  const cached = player.roundHistory[playerCardKey(tripId, round)];
  const course: Course | undefined = cached?.course;
  const myDaily = cached?.players[my]?.daily;
  const scores = remote?.scores ?? null;
  const gross = scores ? scores.reduce((a, b) => a + b, 0) : 0;
  const pts = scores && course && myDaily != null
    ? scores.reduce((a, s, h) => a + holePoints(s, course.pars[h], course.sis[h], myDaily), 0)
    : null;
  const canExpand = !isCurrent && !!course && !!scores;

  if (loading) {
    return <div className="card row" data-testid={`round-row-${round}`}>Round {round} — checking…</div>;
  }
  if (error) {
    return (
      <div className="card row" data-testid={`round-row-${round}`}>
        <span className="p-name">Round {round}</span>
        <span className="error-text">Couldn't reach the drop-box</span>
      </div>
    );
  }
  if (!scores) {
    return (
      <div className="card row" data-testid={`round-row-${round}`}>
        <span className="p-name">
          Round {round} {course && <span className="p-sub">{course.name}</span>}
        </span>
        <span className="chip mute">no card</span>
      </div>
    );
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 6 }} data-testid={`round-row-${round}`}>
      <button
        className="row"
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: 0 }}
        onClick={() => (isCurrent ? nav("/player/mine") : canExpand ? onToggle() : undefined)}
      >
        <span className="p-name">
          Round {round} {course && <span className="p-sub">{course.name}</span>}
          <div className="p-sub num">gross <span data-testid={`round-gross-${round}`}>{gross}</span></div>
        </span>
        {pts != null ? (
          <span className="p-pts num" data-testid={`round-pts-${round}`}>{pts} pts</span>
        ) : (
          <span className="chip mute">no points context</span>
        )}
      </button>
      {pts == null && !isCurrent && (
        <p className="hint" style={{ margin: 0 }}>
          Open this round's pack on this device to see a points breakdown.
        </p>
      )}
      {expanded && course && (
        <div style={{ padding: 9 }}>
          {[0, 9].map((off) => (
            <div className="holes-strip" style={{ marginBottom: off === 0 ? 4 : 0 }} key={off}>
              {Array.from({ length: 9 }, (_, i) => {
                const h = off + i;
                const s = scores[h];
                const hp = s && myDaily != null ? holePoints(s, course.pars[h], course.sis[h], myDaily) : 0;
                return (
                  <div
                    key={h}
                    className={`hs num ${s ? "done" : ""}`}
                    aria-label={`hole ${h + 1}${s ? `, score ${s}, ${hp} points` : ""}`}
                  >
                    {s ? (<>{s}<sup className={`sup-pts ${hp === 0 ? "zero" : ""}`}>{hp}</sup></>) : h + 1}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
