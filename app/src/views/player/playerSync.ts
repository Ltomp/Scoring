import { submitCard, createOutbox } from "../../sync/dropbox";
import { getState, mutate, playerCardKey } from "../../state/store";

export type SyncStatus = "synced" | "pending" | "offline" | "nodropbox";

let statusListeners = new Set<(s: SyncStatus) => void>();
let current: SyncStatus = "synced";

function setStatus(s: SyncStatus) {
  current = s;
  statusListeners.forEach((l) => l(s));
}

export function onSyncStatus(l: (s: SyncStatus) => void): () => void {
  statusListeners.add(l);
  l(current);
  return () => statusListeners.delete(l);
}

const outbox = createOutbox({
  async send() {
    const { player } = getState();
    const pack = player.pack;
    if (!pack?.dropbox || player.myIndex == null) return;
    const key = playerCardKey(pack.tripId, pack.round);
    const card = player.cards[key];
    if (!card) return;
    const done = card.scores.every((s) => s > 0) || card.scores.filter((s) => s > 0).length === 18;
    await submitCard(
      pack.dropbox, pack.tripId, pack.dropbox.writeKey,
      pack.round, player.myIndex, pack.players[player.myIndex]?.name ?? "",
      card.scores, done,
    );
    mutate((d) => {
      const c = d.player.cards[key];
      if (c) c.syncedAt = Date.now();
    });
  },
  onStatus: setStatus,
});

/** Call after every score change. */
export function pushCard(): void {
  const pack = getState().player.pack;
  if (!pack?.dropbox) {
    setStatus("nodropbox");
    return;
  }
  outbox.push();
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => outbox.kick());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") outbox.kick();
  });
}
