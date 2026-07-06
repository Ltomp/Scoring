import { useState } from "react";
import { createTrip, mutate, useAppState } from "../../state/store";
import { nav } from "../../router";
import { registerTrip } from "../../sync/dropbox";
import { orgCompute } from "./orgCompute";
import { DEFAULT_DROPBOX } from "../../dropboxConfig";
import { pushTripMeta } from "../../state/tripSync";

export function NewTrip() {
  const { trips } = useAppState();
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [url, setUrl] = useState(trips[0]?.dropbox?.url ?? DEFAULT_DROPBOX?.url ?? "");
  const [anonKey, setAnonKey] = useState(trips[0]?.dropbox?.anonKey ?? DEFAULT_DROPBOX?.anonKey ?? "");
  const [showDropbox, setShowDropbox] = useState(false);
  const [copyFrom, setCopyFrom] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const previous = trips.filter((t) => t.players.length > 0);

  async function create() {
    setBusy(true);
    setErr("");
    const dropbox = url.trim() && anonKey.trim() ? { url: url.trim(), anonKey: anonKey.trim() } : null;

    let players: { name: string; hcap: number }[] = [];
    const src = trips.find((t) => t.id === copyFrom);
    if (src) {
      // carry the old roster over with their finishing handicaps
      const res = orgCompute(src);
      players = src.players.map((p, i) => ({
        name: p.name,
        hcap: res ? res.endHc[i] : p.hcap,
      }));
    }

    const trip = createTrip(name.trim() || "Golf Trip", year.trim(), dropbox, players);
    if (dropbox) {
      try {
        await registerTrip(dropbox, trip.id, trip.writeKey, trip.readKey);
      } catch (e) {
        setBusy(false);
        setErr(
          `Couldn't reach the drop-box (${e instanceof Error ? e.message : e}). ` +
          "Check the URL and key, or clear them to run without auto-delivery.",
        );
        return;
      }
    }
    mutate((d) => { d.trips.unshift(trip); });
    pushTripMeta(trip.id);
    nav(`/org/t/${trip.id}/setup`);
  }

  return (
    <>
      <div className="appbar">
        <a className="back" href="#/org">‹ Trips</a>
        <div className="titles"><div className="t">New trip</div></div>
        <span />
      </div>
      <main>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field"><span>Trip name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Peninsula Trip" data-testid="trip-name" />
          </label>
          <label className="field"><span>Year</span>
            <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" />
          </label>
          {previous.length > 0 && (
            <label className="field"><span>Roster</span>
              <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                <option value="">Start with an empty roster</option>
                {previous.map((t) => (
                  <option key={t.id} value={t.id}>
                    Copy from “{t.name} {t.year}” (with finishing handicaps)
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="row">
            <div>
              <div className="label">Card drop-box</div>
              <p className="hint" style={{ marginBottom: 0 }}>
                {url && anonKey
                  ? "Using the shared drop-box — markers' cards deliver themselves. Nothing to set up."
                  : "No drop-box set — organisers will key every card by hand."}
              </p>
            </div>
            {!showDropbox && (
              <button className="btn small ghost" onClick={() => setShowDropbox(true)}>
                {url && anonKey ? "Use my own" : "Add one"}
              </button>
            )}
          </div>
          {showDropbox && (
            <>
              <label className="field"><span>Project URL</span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" data-testid="dropbox-url" />
              </label>
              <label className="field"><span>Anon (public) key</span>
                <input value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGciOi…" data-testid="dropbox-key" />
              </label>
              <p className="hint">Own Supabase project: paste its URL/key here (setup steps in the README), or clear both to run without auto-delivery.</p>
            </>
          )}
          {err && <p className="error-text">{err}</p>}
        </div>

        <button className="btn" disabled={busy} onClick={create} data-testid="create-trip">
          {busy ? "Setting up…" : "Create trip ›"}
        </button>
      </main>
    </>
  );
}
