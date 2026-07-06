import { useState } from "react";
import { emptyRound, mutate, normaliseTrip, Trip } from "../../state/store";
import { nav } from "../../router";
import { adjustmentTable, Course, HOLES, MAX_PLAYERS, MAX_ROUNDS } from "../../engine";
import { pushTripMeta } from "../../state/tripSync";
import { shareUrl } from "../../share/codec";
import { ShareSheet } from "../../components/ShareSheet";
import { registerTrip, submitCard } from "../../sync/dropbox";
import { DEFAULT_DROPBOX } from "../../dropboxConfig";

export function TripSetup({ trip }: { trip: Trip }) {
  return (
    <>
      <div className="appbar">
        <a className="back" href={`#/org/t/${trip.id}`}>‹ {trip.name}</a>
        <div className="titles"><div className="t">Trip setup</div><div className="s">{trip.players.length} players · {trip.rounds.length} rounds</div></div>
        <span />
      </div>
      <main>
        <DropboxAccess trip={trip} />
        <Roster trip={trip} />
        <HandicapAdjustment trip={trip} />
        <Rounds trip={trip} />
        <button className="btn" onClick={() => nav(`/org/t/${trip.id}`)} data-testid="setup-done">Done ›</button>
      </main>
    </>
  );
}

function DropboxAccess({ trip }: { trip: Trip }) {
  const [showAccess, setShowAccess] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [dbUrl, setDbUrl] = useState(DEFAULT_DROPBOX?.url ?? "");
  const [dbKey, setDbKey] = useState(DEFAULT_DROPBOX?.anonKey ?? "");
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState("");

  async function connectDropbox() {
    const dropbox = { url: dbUrl.trim(), anonKey: dbKey.trim() };
    if (!dropbox.url || !dropbox.anonKey) {
      setConnectErr("Enter both the project URL and anon key.");
      return;
    }
    setConnecting(true);
    setConnectErr("");
    try {
      await registerTrip(dropbox, trip.id, trip.writeKey, trip.readKey);
    } catch (e) {
      setConnecting(false);
      setConnectErr(`Couldn't reach the drop-box (${e instanceof Error ? e.message : e}). Check the URL and key.`);
      return;
    }
    mutate((d) => { d.trips.find((t) => t.id === trip.id)!.dropbox = dropbox; });
    pushTripMeta(trip.id);
    // bulk-push every card already on this trip — otherwise trip-meta would
    // say a round is complete but a second device's card fetch comes back empty
    trip.rounds.forEach((r, i) => {
      r.cards.forEach((card, p) => {
        if (!card) return;
        const done = r.cardMeta[p]?.final ?? r.completed;
        submitCard(dropbox, trip.id, trip.writeKey, i + 1, p, trip.players[p]?.name ?? "", card, done).catch(() => {});
      });
    });
    setConnecting(false);
    setShowConnect(false);
  }

  return trip.dropbox ? (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button className="btn" onClick={() => setShowAccess(!showAccess)}>
        {showAccess ? "Hide organiser access" : "Access this trip on another device"}
      </button>
      {showAccess && (
        <ShareSheet
          url={shareUrl({
            v: 1, kind: "org", tripId: trip.id, tripName: trip.name || "Golf Trip",
            dropbox: trip.dropbox, writeKey: trip.writeKey, readKey: trip.readKey,
          })}
          title={`Organiser access — ${trip.name}`}
          qrLabel="Open on a laptop or a co-organiser's phone"
        />
      )}
      <p className="hint">
        This link gives full organiser access — roster, scores, penalties, the lot.
        Only share it with people you want running the comp.
      </p>
    </div>
  ) : showConnect ? (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="label">Connect a drop-box</div>
      <label className="field"><span>Project URL</span>
        <input value={dbUrl} onChange={(e) => setDbUrl(e.target.value)} placeholder="https://xxxx.supabase.co" data-testid="dropbox-url" />
      </label>
      <label className="field"><span>Anon (public) key</span>
        <input value={dbKey} onChange={(e) => setDbKey(e.target.value)} placeholder="eyJhbGciOi…" data-testid="dropbox-key" />
      </label>
      {connectErr && <p className="error-text">{connectErr}</p>}
      <div className="btn-row">
        <button className="btn" disabled={connecting} onClick={connectDropbox} data-testid="connect-dropbox">
          {connecting ? "Connecting…" : "Connect ›"}
        </button>
        <button className="btn ghost" onClick={() => setShowConnect(false)}>Cancel</button>
      </div>
    </div>
  ) : (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <p className="hint">
        No drop-box on this trip, so it only lives on this device — use Backup/Restore
        on the trip screen to move it, or connect one to get auto-sync and access from
        other devices.
      </p>
      <button className="btn ghost" onClick={() => setShowConnect(true)} data-testid="show-connect-dropbox">
        Connect a drop-box
      </button>
    </div>
  );
}

function HandicapAdjustment({ trip }: { trip: Trip }) {
  const saved = trip.maxAdjustment ?? 2;
  const [val, setVal] = useState(String(saved));
  const n = trip.players.length;
  const parsed = Number(val);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const previewMax = valid ? parsed : saved;

  const onChange = (v: string) => {
    setVal(v);
    const num = Number(v);
    if (Number.isFinite(num) && num > 0) {
      mutate((d) => { d.trips.find((x) => x.id === trip.id)!.maxAdjustment = num; });
      pushTripMeta(trip.id);
    }
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="label">Handicap adjustment</div>
      <p className="hint" style={{ marginTop: -4 }}>
        Enter the amount lost by the round winner (and gained by last place) as a
        positive number — everyone in between is spread in equal steps across
        the field, so the table below auto-scales to your roster size.
      </p>
      <label className="field"><span>Max adjustment</span>
        <input
          inputMode="decimal"
          value={val}
          onChange={(e) => onChange(e.target.value)}
          data-testid="max-adjustment"
        />
      </label>
      {!valid && <p className="error-text">Enter a positive number.</p>}
      {n > 0 ? (
        <div className="mini-table">
          <table style={{ width: "100%" }}>
            <thead><tr><th>Position</th><th>Adjustment</th></tr></thead>
            <tbody>
              {adjustmentTable(n, previewMax).map((a, i) => (
                <tr key={i}>
                  <td className="num">{i + 1}</td>
                  <td className="num" data-testid={`adj-pos-${i + 1}`}>{fmtAdj(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="hint">Add players to see the adjustment table.</p>
      )}
    </div>
  );
}

function fmtAdj(a: number): string {
  const r = Math.round(a * 100) / 100;
  return r === 0 ? "0" : r > 0 ? `+${r}` : String(r);
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
