import { describe, expect, it, vi } from "vitest";
import { createOutbox } from "../dropbox";

describe("offline outbox", () => {
  it("delivers on push and reports synced", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const statuses: string[] = [];
    const ob = createOutbox({ send, onStatus: (s) => statuses.push(s) });
    ob.push();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(statuses.at(-1)).toBe("synced");
    expect(ob.isDirty).toBe(false);
  });

  it("stays dirty on failure and retries on kick", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("no signal")).mockResolvedValue(undefined);
    const statuses: string[] = [];
    const ob = createOutbox({ send, onStatus: (s) => statuses.push(s), retryMs: 100000 });
    ob.push();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(ob.isDirty).toBe(true);
    ob.kick(); // signal returns
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(statuses.at(-1)).toBe("synced");
    expect(ob.isDirty).toBe(false);
  });

  it("collapses rapid changes into the latest state", async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => (resolve = r));
    const send = vi.fn().mockImplementation(() => gate);
    const ob = createOutbox({ send, onStatus: () => {}, retryMs: 10 });
    ob.push();
    ob.push(); // changed again while first send in flight
    resolve();
    await vi.waitFor(() => expect(send.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(send.mock.calls.length).toBeLessThan(4); // not one send per keystroke
  });
});
