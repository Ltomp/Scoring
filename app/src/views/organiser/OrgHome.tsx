import { mutate, useAppState } from "../../state/store";
import { nav } from "../../router";

export function OrgHome() {
  const { trips } = useAppState();
  const active = trips.filter((t) => !t.archived);
  const archived = trips.filter((t) => t.archived);

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/">‹ Home</a>
        <div className="titles"><div className="t">Organiser</div><div className="s">Trips on this phone</div></div>
        <span />
      </div>
      <main>
        {active.length === 0 && (
          <div className="card">
            <div className="label">No trips yet</div>
            <p className="hint" style={{ fontSize: 13.5 }}>
              Create the trip here on the organiser's phone. Players never need this
              section — they just tap the round links you share.
            </p>
          </div>
        )}
        {active.map((t) => (
          <button key={t.id} className="card row" style={{ width: "100%", textAlign: "left" }} onClick={() => nav(`/org/t/${t.id}`)}>
            <span className="p-name">
              {t.name || "(unnamed trip)"} {t.year && <span className="p-sub">· {t.year}</span>}
              <div className="p-sub">{t.players.length} players · {t.rounds.length} round(s)</div>
            </span>
            <span className="chip ok">open ›</span>
          </button>
        ))}
        <button className="btn" onClick={() => nav("/org/new")} data-testid="new-trip">+ Start new trip</button>

        {archived.length > 0 && <div className="label" style={{ padding: "8px 6px 0" }}>Archive</div>}
        {archived.map((t) => (
          <div key={t.id} className="card row">
            <button className="p-name" style={{ background: "none", border: 0, textAlign: "left", padding: 0 }} onClick={() => nav(`/org/t/${t.id}`)}>
              {t.name} <span className="p-sub">· {t.year}</span>
            </button>
            <button
              className="btn small danger"
              onClick={() => {
                if (confirm(`Delete "${t.name}" forever? This cannot be undone.`))
                  mutate((d) => { d.trips = d.trips.filter((x) => x.id !== t.id); });
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </main>
    </>
  );
}
