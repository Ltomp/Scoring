import { useEffect, useState } from "react";
import { useAppState } from "../../state/store";
import { nav } from "../../router";
import { holePoints } from "../../engine";
import { fetchOwnCard, RemoteOwnCard } from "../../sync/dropbox";

/**
 * Read-only view of a player's own official card — the one their marking
 * partner keeps for them — fetched straight from the drop-box via the
 * player's write key (gts_fetch_own_card only ever returns this one card,
 * never anyone else's or the comp). Never editable here; corrections go
 * through an organiser.
 */
export function MyCard() {
  const { player } = useAppState();
  const pack = player.pack;
  const my = player.myIndex;
  const [status, setStatus] = useState<"loading" | "done" | "error" | "nodropbox">("loading");
  const [remote, setRemote] = useState<RemoteOwnCard | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!pack || my == null) return;
    if (!pack.dropbox) { setStatus("nodropbox"); return; }
    setStatus("loading");
    fetchOwnCard(pack.dropbox, pack.tripId, pack.dropbox.writeKey, pack.round, my)
      .then((row) => { setRemote(row); setStatus("done"); })
      .catch((e) => { setErr(e instanceof Error ? e.message : String(e)); setStatus("error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack?.tripId, pack?.round, my]);

  if (!pack || my == null) { nav("/player"); return null; }
  const me = pack.players[my];
  const totalPts = remote
    ? remote.scores.reduce((a, s, h) => a + holePoints(s, pack.course.pars[h], pack.course.sis[h], me.daily), 0)
    : 0;

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/player">‹ Card</a>
        <div className="titles">
          <div className="t">My scores</div>
          <div className="s">{pack.course.name} · Rd {pack.round}</div>
        </div>
        <span />
      </div>
      <main>
        {status === "nodropbox" && (
          <div className="card">
            <div className="label">No drop-box on this trip</div>
            <p className="hint" style={{ fontSize: 13.5 }}>
              There's nothing to check remotely without one — ask your organiser how
              your card is looking.
            </p>
          </div>
        )}
        {status === "loading" && <div className="card hint">Checking…</div>}
        {status === "error" && <p className="error-text" style={{ padding: "0 4px" }}>Couldn't reach the drop-box: {err}</p>}
        {status === "done" && !remote && (
          <div className="card">
            <div className="label">Nothing recorded yet</div>
            <p className="hint" style={{ fontSize: 13.5 }}>
              Your marker hasn't entered any of your scores yet — check back once
              they've started your card.
            </p>
          </div>
        )}
        {status === "done" && remote && (
          <>
            <div className="card hero">
              <div className="label">Your total</div>
              <div className="big">{totalPts} pts</div>
              <div className="meta">
                {remote.done ? "Submitted by your marker" : "Still a draft — not yet submitted"}
                {" · "}h'cap {me.daily}
              </div>
            </div>
            <div className="card" style={{ padding: 9 }}>
              {[0, 9].map((off) => (
                <div className="holes-strip" style={{ marginBottom: off === 0 ? 4 : 0 }} key={off}>
                  {Array.from({ length: 9 }, (_, i) => {
                    const h = off + i;
                    const s = remote.scores[h];
                    const hp = s ? holePoints(s, pack.course.pars[h], pack.course.sis[h], me.daily) : 0;
                    return (
                      <div
                        key={h}
                        className={`hs num ${s ? "done" : ""}`}
                        aria-label={`hole ${h + 1}${s ? `, score ${s}, ${hp} points` : ", no score yet"}`}
                      >
                        {s ? (<>{s}<sup className={`sup-pts ${hp === 0 ? "zero" : ""}`}>{hp}</sup></>) : h + 1}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="hint" style={{ padding: "0 6px" }}>
              This is read-only — it's your marker's card. Spot a mistake? Ask an
              organiser to fix it.
            </p>
          </>
        )}
      </main>
    </>
  );
}
