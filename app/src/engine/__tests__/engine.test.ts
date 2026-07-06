import { describe, expect, it } from "vitest";
import fixture from "../../../fixtures/trip-fixture.json";
import { adjustment, adjustmentTable, computeTrip, holePoints, strokesReceived, roundHalf, TripInput } from "..";

const trip = fixture.trip as unknown as TripInput;
const exp = fixture.expected;

describe("rules engine vs verified spreadsheet model", () => {
  const res = computeTrip(trip);
  const R = trip.rounds.length;
  const N = trip.players.length;

  it("handicap chain into each round", () => {
    for (let r = 0; r < R; r++)
      for (let p = 0; p < N; p++)
        expect(res.hcInto[r][p], `hcInto r${r + 1} p${p + 1}`).toBeCloseTo(exp.hcInto[r][p], 9);
    for (let p = 0; p < N; p++)
      expect(res.endHc[p], `endHc p${p + 1}`).toBeCloseTo(exp.endHc[p], 9);
  });

  it("daily handicaps (Excel-style rounding)", () => {
    expect(res.daily).toEqual(exp.daily);
  });

  it("per-hole stableford points", () => {
    for (let r = 0; r < R; r++)
      for (let p = 0; p < N; p++)
        expect(res.rounds[r].pts[p], `pts r${r + 1} p${p + 1}`).toEqual(exp.pts[r][p]);
  });

  it("raw totals, played flags and absentee averages", () => {
    for (let r = 0; r < R; r++) {
      expect(res.rounds[r].raw, `raw r${r + 1}`).toEqual(exp.raw[r]);
      expect(res.rounds[r].played, `played r${r + 1}`).toEqual(exp.played[r]);
      expect(res.rounds[r].avg, `avg r${r + 1}`).toBe(exp.avg[r]);
    }
  });

  it("net points (penalties applied), countback keys and positions", () => {
    for (let r = 0; r < R; r++) {
      expect(res.rounds[r].net, `net r${r + 1}`).toEqual(exp.net[r]);
      expect(res.rounds[r].key, `key r${r + 1}`).toEqual(exp.key[r]);
      expect(res.rounds[r].pos, `pos r${r + 1}`).toEqual(exp.pos[r]);
    }
  });

  it("trip totals and overall positions", () => {
    expect(res.totals).toEqual(exp.totals);
    expect(res.overallPos).toEqual(exp.overallPos);
  });

  it("adjustment table auto-scaling for various field sizes", () => {
    for (const [n, table] of Object.entries(exp.adjTable))
      expect(adjustmentTable(Number(n)), `n=${n}`).toEqual(table);
  });
});

describe("primitives", () => {
  it("rounds half away from zero like Excel", () => {
    expect(roundHalf(14.5)).toBe(15);
    expect(roundHalf(14.25)).toBe(14);
    expect(roundHalf(-1.5)).toBe(-2);
    expect(roundHalf(0.5)).toBe(1);
  });

  it("allocates up to three strokes", () => {
    expect(strokesReceived(7, 15)).toBe(1);
    expect(strokesReceived(16, 15)).toBe(0);
    expect(strokesReceived(2, 21)).toBe(2);
    expect(strokesReceived(1, 38)).toBe(3);
  });

  it("scores stableford incl. wipes", () => {
    expect(holePoints(5, 4, 7, 15)).toBe(2); // one stroke, nett par
    expect(holePoints(0, 4, 7, 15)).toBe(0); // wipe
    expect(holePoints(9, 4, 18, 5)).toBe(0); // blowout floors at 0
    expect(holePoints(3, 4, 1, 38)).toBe(6); // 3 strokes, gross birdie
  });

  it("scales the handicap adjustment cap when given a custom max", () => {
    // default (maxAdj=2) unaffected by the new optional param
    expect(adjustment(1, 32)).toBe(adjustment(1, 32, 2));
    // large field, custom cap of 1 actually bites (0.25*20=5 would exceed it)
    expect(adjustment(1, 40, 1)).toBe(-1);
    expect(adjustment(40, 40, 1)).toBe(1);
    // small field: the step simply runs out before a generous custom cap of 4
    expect(adjustment(1, 8, 4)).toBe(-1);
    expect(adjustment(8, 8, 4)).toBe(1);
    // full table for a small field with a small custom cap
    expect(adjustmentTable(4, 1)).toEqual([-0.5, -0.25, 0.25, 0.5]);
  });
});
