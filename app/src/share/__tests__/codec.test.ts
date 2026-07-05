import { describe, expect, it } from "vitest";
import { decodePayload, encodePayload } from "../codec";
import { CardPayload, RoundPackPayload } from "../payloads";

describe("share codec", () => {
  it("round-trips a full 32-player round pack within QR limits", () => {
    const pack: RoundPackPayload = {
      v: 1,
      kind: "pack",
      tripId: "0f8b2c34-1111-2222-3333-444455556666",
      tripName: "Peninsula Trip 2026",
      round: 3,
      course: {
        name: "St Andrews Beach Golf Course",
        pars: [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4],
        sis: [11, 6, 17, 18, 10, 1, 16, 15, 4, 7, 12, 14, 13, 8, 2, 9, 3, 5],
      },
      players: Array.from({ length: 32 }, (_, i) => ({
        name: `Player With A Longish Name ${i + 1}`,
        daily: 5 + (i % 30),
      })),
      dropbox: {
        url: "https://abcdefghijklmnopqrst.supabase.co",
        anonKey: "x".repeat(200),
        writeKey: "w".repeat(32),
      },
    };
    const blob = encodePayload(pack);
    expect(decodePayload(blob)).toEqual(pack);
    // QR version 40 (L) holds ~2953 bytes; stay well under with URL prefix headroom
    expect(blob.length).toBeLessThan(2300);
  });

  it("round-trips a card payload compactly", () => {
    const card: CardPayload = {
      v: 1,
      kind: "card",
      tripId: "0f8b2c34-1111-2222-3333-444455556666",
      round: 2,
      player: 7,
      name: "Tompkins, Lawrie",
      scores: [5, 4, 7, 9, 3, 2, 6, 8, 7, 8, 5, 8, 3, 4, 5, 3, 6, 6],
    };
    const blob = encodePayload(card);
    expect(decodePayload(blob)).toEqual(card);
    expect(blob.length).toBeLessThan(300);
  });

  it("rejects junk", () => {
    expect(() => decodePayload("not-a-blob")).toThrow();
  });
});
