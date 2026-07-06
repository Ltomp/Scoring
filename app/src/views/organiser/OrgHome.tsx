import { useEffect, useRef, useState } from "react";
import { adoptTrip, getState, mutate, normaliseTrip, Trip, useAppState } from "../../state/store";
import { nav } from "../../router";
import { DropboxConfig } from "../../share/payloads";
import { DEFAULT_DROPBOX } from "../../dropboxConfig";
import { deleteTrip, listTrips } from "../../sync/dropbox";
import { applyTripMeta, TripMeta } from "../../state/tripSync";
import { fetchAndMergeAllCards } from "../../state/cardSync";

function sameDropbox(a: DropboxConfig, b: DropboxConfig): boolean {
  return a.url === b.url && a.anonKey === b.anonKey;
}

/**
 * Every drop-box project this device has any relationship with: the
 * baked-in default (so a fresh device still discovers the common case),
 * plus any custom project already used by a trip this device knows about.
 */
function knownDropboxes(trips: Trip[]): DropboxConfig[] {
  const list: DropboxConfig[] = DEFAULT_DROPBOX ? [DEFAULT_DROPBOX] : [];
  for (const t of trips) {
    if (t.dropbox && !list.some((d) => sameDropbox(d, t.dropbox!))) list.push(t.dropbox);
  }
  return list;
}

/**
 * #/org auto-discovers every trip on a known drop-box project — no link/QR
 * handshake required (see supabase/schema.sql's gts_list_trips). Trips
 * already known locally are left untouched; anything new is adopted and
 * hydrated in place.
 */
function useTripDiscovery() {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const configs = knownDropboxes(getState().trips);
    if (configs.length === 0) return;
    setChecking(true);
    (async () => {
      for (const cfg of configs) {
        try {
          const rows = await listTrips<TripMeta>(cfg);
          if (cancelled) return;
          for (const row of rows) {
            if (getState().trips.some((t) => t.id === row.id)) continue;
            mutate((d) => {
              if (d.trips.some((t) => t.id === row.id)) return;
              const trip = adoptTrip({
                v: 1, kind: "org", tripId: row.id, tripName: row.state?.name ?? "",
                dropbox: cfg, writeKey: row.writeKey, readKey: row.readKey,
              });
              if (row.state) applyTripMeta(trip, row.state);
              d.trips.unshift(trip);
            });
            const trip = getState().trips.find((t) => t.id === row.id);
            if (trip) fetchAndMergeAllCards(trip).catch(() => {});
          }
        } catch {
          // offline or that project is unreachable — skip it, don't block the rest
        }
      }
    })().finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return checking;
}

export function OrgHome() {
  const { trips } = useAppState();
  const checking = useTripDiscovery();
  const fileRef = useRef<HTMLInputElement>(null);

  const removeTrip = async (t: Trip) => {
    if (!confirm(`Delete "${t.name}" forever? This cannot be undone.`)) return;
    if (t.dropbox) {
      try {
        await deleteTrip(t.dropbox, t.id, t.readKey);
      } catch (e) {
        alert(`Couldn't delete from the drop-box (${e instanceof Error ? e.message : e}) — try again.`);
        return;
      }
    }
    mutate((d) => { d.trips = d.trips.filter((x) => x.id !== t.id); });
  };

  const restore = async (file: File) => {
    try {
      const t = JSON.parse(await file.text()) as Trip;
      if (!t?.id || !Array.isArray(t.players) || !Array.isArray(t.rounds) || !t.writeKey || !t.readKey) {
        throw new Error("That file isn't a trip backup from this app.");
      }
      const existing = trips.find((x) => x.id === t.id);
      if (existing && !confirm(`"${t.name}" already exists on this device — replace it with the backup?`)) return;
      mutate((d) => {
        normaliseTrip(t);
        d.trips = [t, ...d.trips.filter((x) => x.id !== t.id)];
      });
      nav(`/org/t/${t.id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't read that backup file.");
    }
  };
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
        {checking && <p className="hint" style={{ padding: "0 6px" }}>Checking for other trips…</p>}
        {active.length === 0 && !checking && (
          <div className="card">
            <div className="label">No trips yet</div>
            <p className="hint" style={{ fontSize: 13.5 }}>
              This page is just for organisers — bookmark it, since players never see a
              link to it. They only ever tap the round links you share with them.
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
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          Restore trip from backup (JSON)
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
            e.target.value = "";
          }}
        />
        <p className="hint" style={{ padding: "0 6px" }}>
          Any trip with a drop-box configured just shows up here on its own — no
          export/import, no link to generate. Restore-from-backup is the fallback for
          trips with no drop-box at all.
        </p>

        {archived.length > 0 && <div className="label" style={{ padding: "8px 6px 0" }}>Archive</div>}
        {archived.map((t) => (
          <div key={t.id} className="card row">
            <button className="p-name" style={{ background: "none", border: 0, textAlign: "left", padding: 0 }} onClick={() => nav(`/org/t/${t.id}`)}>
              {t.name} <span className="p-sub">· {t.year}</span>
            </button>
            <button className="btn small danger" onClick={() => void removeTrip(t)}>
              Delete
            </button>
          </div>
        ))}
      </main>
    </>
  );
}
