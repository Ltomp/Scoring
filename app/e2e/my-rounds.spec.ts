import { expect, test } from "@playwright/test";
import { startStubDropbox } from "./stub-dropbox.mjs";

/**
 * "My rounds" lets a player browse every round they have a card for on this
 * trip, not just the one they were most recently sent a link for. Course +
 * daily h'cap context (needed to show a points breakdown) is only ever
 * cached locally on whichever device opened that round's pack — never
 * persisted remotely — so this test proves all three properties that
 * design implies:
 *   1. a device that opened both rounds' packs sees points for both
 *   2. scores are always re-fetched from the drop-box, so an organiser's
 *      post-hoc correction shows up immediately, not a stale local copy
 *   3. a device that only ever opened round 2's pack still sees round 1's
 *      gross total (fetched live) but no points breakdown for it, since
 *      it never cached round 1's course/daily context
 *
 * All-par-4 course, SI 1..18 ascending, both players shoot exactly gross
 * par on every hole in both rounds, so points are simple to hand-check:
 *   points/hole = par + 2 - score + strokes = 2 + strokes (since score=par)
 *   strokes = 1 per hole with SI <= daily h'cap (<=18 always here), so
 *     round total = 36 + daily h'cap
 *
 * Round 1 daily h'caps = starting: Amy 10, Ben 14.
 *   Amy: 36 + 10 = 46. Ben: 36 + 14 = 50.
 * Round 1 order (2-player field): Ben wins (pos 1, -2), Amy last (pos 2, +2).
 *   Ben 14-2=12, Amy 10+2=12.
 * Round 2 daily h'caps: Amy 12, Ben 12.
 *   Amy: 36 + 12 = 48. Ben: 36 + 12 = 48.
 */
const APP = "/Scoring/";
const PARS = Array(18).fill(4).join(" ");
const SIS = Array.from({ length: 18 }, (_, i) => i + 1).join(" ");

test("a player can browse past rounds, sees corrections live, and past context degrades gracefully off-device", async ({ browser }) => {
  test.setTimeout(120000);
  const stub = await startStubDropbox();

  const org = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const orgPage = await org.newPage();
  await orgPage.goto(`${APP}#/org`);
  await orgPage.getByTestId("new-trip").click();
  await orgPage.getByTestId("trip-name").fill("My Rounds Cup");
  await orgPage.getByRole("button", { name: /Use my own/ }).click();
  await orgPage.getByTestId("dropbox-url").fill(stub.url);
  await orgPage.getByTestId("dropbox-key").fill("stub-key");
  await orgPage.getByTestId("create-trip").click();

  for (const [name, hcap] of [["Amy Archer", "10"], ["Ben Baxter", "14"]] as const) {
    await orgPage.getByTestId("player-name").fill(name);
    await orgPage.getByTestId("player-hcap").fill(hcap);
    await orgPage.getByTestId("add-player").click();
  }
  await orgPage.getByTestId("add-round").click();
  await orgPage.getByTestId("course-name-0").fill("Rounds Links");
  await orgPage.getByTestId("course-paste-0").fill(`${PARS}\n${SIS}`);
  await orgPage.getByTestId("course-save-0").click();
  await orgPage.getByTestId("add-round").click();
  await orgPage.getByTestId("course-name-1").fill("Second Day Links");
  await orgPage.getByTestId("course-paste-1").fill(`${PARS}\n${SIS}`);
  await orgPage.getByTestId("course-save-1").click();
  await orgPage.getByTestId("setup-done").click();

  const amy = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const amyPage = await amy.newPage();
  const ben = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const benPage = await ben.newPage();

  // =========================================================== ROUND 1
  await orgPage.getByRole("button", { name: /^Round 1 / }).click();
  await orgPage.getByTestId("share-pack").click();
  const pack1Url = await orgPage.getByTestId("share-url").inputValue();

  await amyPage.goto(pack1Url);
  await amyPage.getByRole("button", { name: "That's me" }).nth(0).click(); // Amy
  await amyPage.getByTestId("mark-1").click(); // marking Ben
  await amyPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await amyPage.getByTestId("next-hole").click();
  await amyPage.getByTestId("finish-card").click();
  await expect(amyPage.getByTestId("submit-total")).toHaveText("50 pts"); // Ben's card
  await amyPage.getByTestId("submit-round").click();

  await benPage.goto(pack1Url);
  await benPage.getByRole("button", { name: "That's me" }).nth(1).click(); // Ben
  await benPage.getByTestId("mark-0").click(); // marking Amy
  await benPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await benPage.getByTestId("next-hole").click();
  await benPage.getByTestId("finish-card").click();
  await expect(benPage.getByTestId("submit-total")).toHaveText("46 pts"); // Amy's card
  await benPage.getByTestId("submit-round").click();

  await expect(orgPage.getByTestId("dg-pts-0")).toHaveText("46", { timeout: 20000 }); // Amy
  await expect(orgPage.getByTestId("dg-pts-1")).toHaveText("50", { timeout: 20000 }); // Ben
  await orgPage.getByTestId("complete-round").click();

  // =========================================================== ROUND 2
  await orgPage.getByRole("link", { name: /‹ Round 1/ }).click(); // Results -> Round 1 dashboard
  await orgPage.getByRole("link", { name: /‹ My Rounds Cup/ }).click(); // Round 1 dashboard -> Trip Home
  await orgPage.getByRole("button", { name: /^Round 2 / }).click();
  await expect(orgPage.getByTestId("dg-hc-0")).toHaveText("12", { timeout: 20000 }); // Amy 10-2 -> 12
  await expect(orgPage.getByTestId("dg-hc-1")).toHaveText("12", { timeout: 20000 }); // Ben 14-2 -> 12
  await orgPage.getByTestId("share-pack").click();
  const pack2Url = await orgPage.getByTestId("share-url").inputValue();

  await amyPage.goto(pack2Url);
  await amyPage.getByTestId("mark-1").click(); // Amy marks Ben again
  await amyPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await amyPage.getByTestId("next-hole").click();
  await amyPage.getByTestId("finish-card").click();
  await expect(amyPage.getByTestId("submit-total")).toHaveText("48 pts");
  await amyPage.getByTestId("submit-round").click();

  await benPage.goto(pack2Url);
  await benPage.getByTestId("mark-0").click(); // Ben marks Amy again
  await benPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await benPage.getByTestId("next-hole").click();
  await benPage.getByTestId("finish-card").click();
  await expect(benPage.getByTestId("submit-total")).toHaveText("48 pts");
  await benPage.getByTestId("submit-round").click();

  await expect(orgPage.getByTestId("dg-pts-0")).toHaveText("48", { timeout: 20000 });
  await expect(orgPage.getByTestId("dg-pts-1")).toHaveText("48", { timeout: 20000 });

  // ============================================ PART 1: cross-round history
  // Amy's own device opened BOTH packs, so both rounds show a points breakdown.
  await amyPage.goto(`${APP}#/player`);
  await amyPage.getByTestId("my-rounds").click();
  await expect(amyPage.getByTestId("round-gross-1")).toHaveText("72", { timeout: 20000 });
  await expect(amyPage.getByTestId("round-pts-1")).toHaveText("46 pts");
  await expect(amyPage.getByTestId("round-gross-2")).toHaveText("72");
  await expect(amyPage.getByTestId("round-pts-2")).toHaveText("48 pts");

  // ============================================ PART 2: freshness after correction
  // organiser corrects Amy's round-1 hole 1 (SI 1, she had a stroke there):
  // 4 -> 5 drops that hole's points by 1, so her round-1 total 46 -> 45.
  const tripId = orgPage.url().match(/\/t\/([^/]+)/)![1];
  await orgPage.goto(`${APP}#/org/t/${tripId}/r/1`);
  await orgPage.getByTestId("dg-0-0").fill("5"); // Amy, hole 1 (SI 1): one worse
  await expect(orgPage.getByTestId("dg-pts-0")).toHaveText("45", { timeout: 20000 });
  // the desk-grid edit pushes to the drop-box fire-and-forget with no UI sync
  // signal on this path — MyRounds only fetches once per mount (it's a
  // point-in-time view, not a live dashboard), so give the push a moment to
  // land before the player's next visit fetches.
  await orgPage.waitForTimeout(1000);

  // Amy is already sitting on #/player/rounds from Part 1 — a hash-only
  // re-navigation to the same URL wouldn't remount the view or re-run its
  // fetch, so force a real reload to prove the *next visit* picks up the
  // organiser's correction (not that it live-updates a page left open).
  await amyPage.reload();
  await expect(amyPage.getByTestId("round-gross-1")).toHaveText("73", { timeout: 20000 });
  await expect(amyPage.getByTestId("round-pts-1")).toHaveText("45 pts");

  // ============================================ PART 3: degraded fallback off-device
  // a fresh device that only ever opens round 2's pack still sees round 1's
  // corrected gross total (fetched live) but no points breakdown for it.
  const other = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const otherPage = await other.newPage();
  await otherPage.goto(pack2Url);
  await otherPage.getByRole("button", { name: "That's me" }).nth(0).click(); // Amy, fresh device
  await otherPage.goto(`${APP}#/player/rounds`);
  await expect(otherPage.getByTestId("round-gross-1")).toHaveText("73", { timeout: 20000 });
  await expect(otherPage.getByTestId("round-row-1")).toContainText("no points context");
  await expect(otherPage.getByTestId("round-pts-1")).toHaveCount(0);
  await expect(otherPage.getByTestId("round-pts-2")).toHaveText("48 pts");
});
