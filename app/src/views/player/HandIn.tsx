import { playerCardKey, useAppState } from "../../state/store";
import { nav } from "../../router";
import { holePoints } from "../../engine";
import { shareUrl } from "../../share/codec";
import { ShareSheet } from "../../components/ShareSheet";

export function HandIn() {
  const { player } = useAppState();
  const pack = player.pack;
  const my = player.myIndex;
  if (!pack || my == null) {
    nav("/player");
    return null;
  }
  const me = pack.players[my];
  const scores = player.cards[playerCardKey(pack.tripId, pack.round)]?.scores ?? [];
  const pts = (from: number, to: number) =>
    scores.slice(from, to).reduce(
      (a, s, i) => a + holePoints(s, pack.course.pars[from + i], pack.course.sis[from + i], me.daily),
      0,
    );
  const gross = (from: number, to: number) => {
    const played = scores.slice(from, to).filter((s) => s > 0);
    return played.reduce((a, b) => a + b, 0);
  };
  const url = shareUrl({
    v: 1, kind: "card", tripId: pack.tripId, round: pack.round,
    player: my, name: me.name, scores,
  });
  const holesIn = scores.filter((s) => s > 0).length;

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/player">‹ Card</a>
        <div className="titles">
          <div className="t">Hand in card</div>
          <div className="s">Round {pack.round} · {pack.course.name}</div>
        </div>
        <span />
      </div>
      <main>
        <div className="card">
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
                    const hp = s ? holePoints(s, pack.course.pars[h], pack.course.sis[h], me.daily) : 0;
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
          <table className="mini-table">
            <thead>
              <tr><th>{me.name}</th><th>Out</th><th>In</th><th>Total</th></tr>
            </thead>
            <tbody>
              <tr><td style={{ color: "var(--ink-soft)" }}>Gross</td><td className="num">{gross(0, 9)}</td><td className="num">{gross(9, 18)}</td><td className="num">{gross(0, 18)}</td></tr>
              <tr className="tot"><td>Points</td><td className="num">{pts(0, 9)}</td><td className="num">{pts(9, 18)}</td><td className="num" data-testid="handin-total">{pts(0, 18)}</td></tr>
            </tbody>
          </table>
          {holesIn < 18 && (
            <p className="error-text" style={{ marginBottom: 0 }}>
              {18 - holesIn} hole(s) have no score — they'll count as wipes (0 points).
            </p>
          )}
        </div>
        <ShareSheet
          url={url}
          title={`Card: ${me.name} — Round ${pack.round}`}
          qrLabel="Show this to an organiser"
        />
        <p className="hint" style={{ padding: "0 6px" }}>
          Your card normally uploads by itself — use this if there's no signal or the
          organiser asks for it. Scanning it puts your card straight into the comp.
        </p>
      </main>
    </>
  );
}
