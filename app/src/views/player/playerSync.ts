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

/**
 * Uploads the PARTNER's card this phone is marking. Drafts stream up as
 * the round is played (done=false); pressing "Submit round" re-sends with
 * done=true, which is what makes the card official.
 */
const outbox = createOutbox({
  async send() {
    const { player } = getState();
    const pack = player.pack;
    if (!pack?.dropbox) return;
    const key = playerCardKey(pack.tripId, pack.round);
    const card = player.cards[key];
    if (!card || card.markIndex == null) return;
    await submitCard(
      pack.dropbox, pack.tripId, pack.dropbox.writeKey,
      pack.round, card.markIndex, pack.players[card.markIndex]?.name ?? "",
      card.scores, card.submittedAt != null,
    );
    mutate((d) => {
      const c = d.player.cards[key];
      if (c) c.syncedAt = Date.now();
    });
  },
  onStatus: setStatus,
});

/** Call after every change to the partner's card (or on submit). */
export function pushCard(): void {
  const pack = getState().player.pack;
  if (!pack?.dropbox) {
    setStatus("nodropbox");
    return;
  }
  outbox.push();
}

export function cardIsDelivered(): boolean {
  return !outbox.isDirty;
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => outbox.kick());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") outbox.kick();
  });
}
