import { useState } from "react";
import { emptyRound, mutate, normaliseTrip, Trip } from "../../state/store";
import { nav } from "../../router";
import { Course, HOLES, MAX_PLAYERS, MAX_ROUNDS } from "../../engine";
import { pushTripMeta } from "../../state/tripSync";

export function TripSetup({ trip }: { trip: Trip }) {
  return (
    <>
      <div className="appbar">
        <a className="back" href={`#/org/t/${trip.id}`}>‹ {trip.name}</a>
        <div className="titles"><div className="t">Trip setup</div><div className="s">{trip.players.length} players · {trip.rounds.length} rounds</div></div>
        <span />
      </div>
      <main>
        <Roster trip={trip} />
        <Rounds trip={trip} />
        <button className="btn" onClick={() => nav(`/org/t/${trip.id}`)} data-testid="setup-done">Done ›</button>
      </main>
    </>
  );
}

function Roster({ trip }: { trip: Trip }) {
  const [name, setName] = useState("");
  const [hcap, setHcap] = useState("");
  const locked = trip.rounds.some((r) => r.cards.some(Boolean));

  const add = () => {
    const h = Number(hcap);
    if (!name.trim() || !Number.isFinite(h) || h < -5 || h > 54) return;
    mutate((d) => {
      const t = d.trips.find((x) => x.id === trip.id)!;
      if (t.players.length >= MAX_PLAYERS) return;
      t.players.push({ name: name.trim(), hcap: h });
      normaliseTrip(t);
    });
    pushTripMeta(trip.id);
    setName("");
    setHcap("");
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="label">Players ({trip.players.length}/{MAX_PLAYERS})</div>
      <div className="divided">
        {trip.players.map((p, i) => (
          <div className="row" key={i}>
            <span className="p-name">{p.name} <span className="p-sub num">h'cap {p.hcap}</span></span>
            {!locked && (
              <button
                className="btn small danger"
                onClick={() => {
                  mutate((d) => {
                    const t = d.trips.find((x) => x.id === trip.id)!;
                    t.players.splice(i, 1);
                    normaliseTrip(t);
                  });
                  pushTripMeta(trip.id);
                }}
              >
                remove
              </button>
            )}
          </div>
        ))}
      </div>
      {locked ? (
        <p className="hint">Roster is locked once cards exist — the comp depends on it.</p>
      ) : (
        <div className="roster-grid">
          <input placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} data-testid="player-name" />
          <input placeholder="H'cap" inputMode="decimal" value={hcap} onChange={(e) => setHcap(e.target.value)} data-testid="player-hcap" />
          <button className="btn small" style={{ gridColumn: "1 / -1" }} onClick={add} data-testid="add-player">+ Add player</button>
        </div>
      )}
    </div>
  );
}

function Rounds({ trip }: { trip: Trip }) {
  return (
    <>
      {trip.rounds.map((_, i) => (
        <CourseEditor key={i} trip={trip} round={i} />
      ))}
      {trip.rounds.length < MAX_ROUNDS && (
        <button
          className="btn ghost"
          onClick={() => {
            mutate((d) => {
              const t = d.trips.find((x) => x.id === trip.id)!;
              t.rounds.push(emptyRound(t.players.length));
            });
            pushTripMeta(trip.id);
          }}
          data-testid="add-round"
        >
          + Add round {trip.rounds.length + 1}
        </button>
      )}
    </>
  );
}

function CourseEditor({ trip, round }: { trip: Trip; round: number }) {
  const r = trip.rounds[round];
  const [open, setOpen] = useState(!r.course);
  const [name, setName] = useState(r.course?.name ?? "");
  const [paste, setPaste] = useState(courseToPaste(r.course));
  const [err, setErr] = useState("");
  const hasCards = r.cards.some(Boolean);

  const save = () => {
    const parsed = parseCourse(name, paste);
    if (typeof parsed === "string") {
      setErr(parsed);
      return;
    }
    mutate((d) => {
      d.trips.find((x) => x.id === trip.id)!.rounds[round].course = parsed;
    });
    pushTripMeta(trip.id);
    setErr("");
    setOpen(false);
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="row">
        <span className="p-name">
          Round {round + 1}
          <div className="p-sub">{r.course ? `${r.course.name} · par ${r.course.pars.reduce((a, b) => a + b, 0)}` : "no course yet"}</div>
        </span>
        {r.course && <span className="chip ok">SI OK ✓</span>}
        <button className="btn small ghost" onClick={() => setOpen(!open)}>{open ? "close" : "edit"}</button>
      </div>
      {open && (
        <>
          <label className="field"><span>Course name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Dunes Golf Links" data-testid={`course-name-${round}`} />
          </label>
          <label className="field">
            <span>Par line + SI line (18 numbers each, from the card)</span>
            <textarea
              rows={3}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Par: 4 4 3 5 4 3 4 5 4 4 3 5 4 4 4 3 5 4\nSI:  16 10 2 4 6 8 12 15 18 1 14 13 17 11 7 9 5 3"}
              data-testid={`course-paste-${round}`}
            />
          </label>
          {err && <p className="error-text">{err}</p>}
          {hasCards && <p className="error-text">Careful: cards already exist for this round — changing the course rescores them.</p>}
          <button className="btn small" onClick={save} data-testid={`course-save-${round}`}>Save course</button>
        </>
      )}
    </div>
  );
}

function courseToPaste(c: Course | null): string {
  if (!c) return "";
  return `${c.pars.join(" ")}\n${c.sis.join(" ")}`;
}

/** Parse two lines of 18 numbers (par then SI) with the workbook's validation. */
export function parseCourse(name: string, paste: string): Course | string {
  if (!name.trim()) return "Give the course a name.";
  const nums = paste.replace(/[^\d\s.,;-]/g, " ").split(/[\s.,;]+/).filter(Boolean).map(Number);
  if (nums.length !== HOLES * 2) return `Need exactly 36 numbers (18 pars then 18 SIs) — got ${nums.length}.`;
  const pars = nums.slice(0, HOLES);
  const sis = nums.slice(HOLES);
  if (pars.some((p) => !Number.isInteger(p) || p < 3 || p > 6)) return "Pars must be whole numbers 3–6.";
  const seen = new Set(sis);
  if (sis.some((s) => !Number.isInteger(s) || s < 1 || s > 18) || seen.size !== 18)
    return "SI must use each of 1–18 exactly once.";
  return { name: name.trim(), pars, sis };
}
