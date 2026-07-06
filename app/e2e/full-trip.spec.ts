import { expect, test } from "@playwright/test";
import { startStubDropbox } from "./stub-dropbox.mjs";

/**
 * A realistic, fully hand-computed two-round trip:
 *  - 4 players, marker rotation (Amy <-> Ben mark each other via the app),
 *    two players (Cam, Dee) keyed by the organiser from paper cards
 *  - a card penalty in round 1
 *  - an absentee in round 2 (ranked field average, loses countback ties)
 *  - handicap carry-over from round 1 into round 2
 *  - the trip leaderboard after both rounds
 *
 * All-par-4 course, SI 1..18 ascending, every player shoots exactly gross
 * par on every hole in both rounds (except the round-1 penalty), so the
 * only variable is each player's handicap -> stroke allocation. That keeps
 * the arithmetic exact and independently checkable:
 *
 *   points/hole = par + 2 - score + strokesReceived = 2 + strokes (since score=par)
 *   strokes = 1 for SI <= daily h'cap (<=18 always here), so:
 *     round total = (holes with SI<=hc)*3 + (holes with SI>hc)*2
 *
 * Round 1 daily h'caps = starting: Amy 8, Ben 12, Cam 16, Dee 20 (20 gets a
 * 2nd stroke on SI 1-2 since 20>18):
 *   Amy: 8*3 + 10*2 = 44
 *   Ben: 12*3 + 6*2 = 48
 *   Cam: 16*3 + 2*2 = 52
 *   Dee: 2*4 + 16*3 = 56, minus a 1-point penalty = 55
 * Round 1 order: Dee 55, Cam 52, Ben 48, Amy 44 (positions 1-4 of 4).
 * Adjustment(pos,n=4,maxAdj=2): linear interpolation, maxAdj*(2*(pos-1)/(n-1)-1)
 *   -> pos1 -2, pos2 -2/3, pos3 +2/3, pos4 +2.
 *   Dee 20-2=18, Cam 16-2/3=15.333, Ben 12+2/3=12.667, Amy 8+2=10
 * Round 2 daily h'caps (rounded half-away-from-zero): Dee 18, Cam 15, Ben 13, Amy 10
 *   Amy: 10*3 + 8*2 = 46
 *   Ben: 13*3 + 5*2 = 49
 *   Cam: 15*3 + 3*2 = 51
 *   Dee: absent -> avg of (46,49,51) = round(146/3) = 49, ties Ben on points
 *        but loses the countback (an absentee's hole-by-hole values are all
 *        zero, so Ben's real countback figures rank him above her)
 * Round 2 order: Cam 51, Ben 49 (wins tie), Dee 49 (avg), Amy 46.
 * Trip totals: Dee 104, Cam 103, Ben 97, Amy 90.
 */

const APP = "/Scoring/";
const PHONE = { viewport: { width: 390, height: 760 } };
const DESK = { viewport: { width: 1280, height: 800 } };
const PARS = Array(18).fill(4).join(" ");
const SIS = Array.from({ length: 18 }, (_, i) => i + 1).join(" ");

async function keyAllPar(page: import("@playwright/test").Page, player: number) {
  for (let h = 0; h < 18; h++) await page.getByTestId(`dg-${player}-${h}`).fill("4");
}

test("full two-round trip: marker rotation, paper cards, penalty, absentee, handicap carry-over", async ({ browser }) => {
  test.setTimeout(180000);
  const stub = await startStubDropbox();

  const org = await browser.newContext(DESK);
  const orgPage = await org.newPage();
  const amy = await browser.newContext(PHONE);
  const amyPage = await amy.newPage();
  const ben = await browser.newContext(PHONE);
  const benPage = await ben.newPage();
  orgPage.on("dialog", (d) => d.accept());

  // ---- trip setup: 4 players, 2 rounds, pointed at the local drop-box stand-in
  await orgPage.goto(`${APP}#/org`);
  await orgPage.getByTestId("new-trip").click();
  await orgPage.getByTestId("trip-name").fill("Full Trip Test");
  await orgPage.getByRole("button", { name: /Use my own/ }).click();
  await orgPage.getByTestId("dropbox-url").fill(stub.url);
  await orgPage.getByTestId("dropbox-key").fill("stub-key");
  await orgPage.getByTestId("create-trip").click();

  for (const [name, hcap] of [
    ["Amy Archer", "8"], ["Ben Baxter", "12"], ["Cam Clarke", "16"], ["Dee Dunn", "20"],
  ] as const) {
    await orgPage.getByTestId("player-name").fill(name);
    await orgPage.getByTestId("player-hcap").fill(hcap);
    await orgPage.getByTestId("add-player").click();
  }
  await orgPage.getByTestId("add-round").click();
  await orgPage.getByTestId("course-name-0").fill("Twilight Links");
  await orgPage.getByTestId("course-paste-0").fill(`${PARS}\n${SIS}`);
  await orgPage.getByTestId("course-save-0").click();
  await orgPage.getByTestId("add-round").click();
  await orgPage.getByTestId("course-name-1").fill("Sunrise Dunes");
  await orgPage.getByTestId("course-paste-1").fill(`${PARS}\n${SIS}`);
  await orgPage.getByTestId("course-save-1").click();
  await orgPage.getByTestId("setup-done").click();

  // =========================================================== ROUND 1
  await orgPage.getByRole("button", { name: /^Round 1 / }).click();
  await orgPage.getByTestId("share-pack").click();
  const pack1Url = await orgPage.getByTestId("share-url").inputValue();

  // Amy marks Ben; Ben marks Amy — real marker rotation, two devices
  await amyPage.goto(pack1Url);
  await amyPage.getByRole("button", { name: "That's me" }).nth(0).click(); // Amy
  await amyPage.getByTestId("mark-1").click(); // marking Ben
  await amyPage.getByTestId("open-card").click();
  await amyPage.getByRole("button", { name: "my score one more" }).click(); // pencil own tally, hole 1
  for (let h = 1; h <= 17; h++) await amyPage.getByTestId("next-hole").click();
  await amyPage.getByTestId("finish-card").click();
  await expect(amyPage.getByTestId("submit-total")).toHaveText("48 pts"); // Ben's card
  await amyPage.getByTestId("submit-round").click();

  await benPage.goto(pack1Url);
  await benPage.getByRole("button", { name: "That's me" }).nth(1).click(); // Ben
  await benPage.getByTestId("mark-0").click(); // marking Amy
  await benPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await benPage.getByTestId("next-hole").click();
  await benPage.getByTestId("finish-card").click();
  await expect(benPage.getByTestId("submit-total")).toHaveText("44 pts"); // Amy's card
  await benPage.getByTestId("submit-round").click();

  // organiser sees both submitted, keys Cam and Dee from paper, penalises Dee
  await expect(orgPage.getByTestId("dg-pts-0")).toHaveText("44", { timeout: 20000 }); // Amy
  await expect(orgPage.getByTestId("dg-pts-1")).toHaveText("48", { timeout: 20000 }); // Ben
  await keyAllPar(orgPage, 2); // Cam
  await keyAllPar(orgPage, 3); // Dee
  await expect(orgPage.getByTestId("dg-pts-2")).toHaveText("52");
  await expect(orgPage.getByTestId("dg-pts-3")).toHaveText("56");
  await orgPage.getByTestId("dg-pen-3").selectOption("1"); // Dee's card penalty

  await orgPage.getByTestId("complete-round").click();
  await expect(orgPage.getByTestId("net-0")).toHaveText("44"); // Amy
  await expect(orgPage.getByTestId("net-1")).toHaveText("48"); // Ben
  await expect(orgPage.getByTestId("net-2")).toHaveText("52"); // Cam
  await expect(orgPage.getByTestId("net-3")).toHaveText("55"); // Dee after penalty
  await orgPage.screenshot({ path: "shots/ft-1-round1-results.png", fullPage: true });

  // ---- trip home: handicaps carried into round 2
  await orgPage.getByRole("link", { name: /‹ Round 1/ }).click();
  await orgPage.getByRole("link", { name: /‹ Full Trip Test/ }).click();
  const hcRows = orgPage.locator(".row").filter({ hasText: "start" });
  await expect(hcRows.filter({ hasText: "Amy Archer" })).toContainText("10");
  await expect(hcRows.filter({ hasText: "Ben Baxter" })).toContainText("12.67");
  await expect(hcRows.filter({ hasText: "Cam Clarke" })).toContainText("15.33");
  await expect(hcRows.filter({ hasText: "Dee Dunn" })).toContainText("18");

  // =========================================================== ROUND 2
  await orgPage.getByRole("button", { name: /^Round 2 / }).click();
  // daily handicaps reflect round 1's movement, rounded half-away-from-zero
  await expect(orgPage.getByTestId("dg-hc-0")).toHaveText("10"); // Amy 10 -> 10
  await expect(orgPage.getByTestId("dg-hc-1")).toHaveText("13"); // Ben 12.667 -> 13
  await expect(orgPage.getByTestId("dg-hc-2")).toHaveText("15"); // Cam 15.333 -> 15
  await expect(orgPage.getByTestId("dg-hc-3")).toHaveText("18"); // Dee 18 -> 18
  await orgPage.getByTestId("share-pack").click();
  const pack2Url = await orgPage.getByTestId("share-url").inputValue();

  await amyPage.goto(pack2Url);
  await amyPage.getByTestId("mark-1").click(); // Amy marks Ben again
  await amyPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await amyPage.getByTestId("next-hole").click();
  await amyPage.getByTestId("finish-card").click();
  await expect(amyPage.getByTestId("submit-total")).toHaveText("49 pts"); // Ben's daily hc is now 13
  await amyPage.getByTestId("submit-round").click();

  await benPage.goto(pack2Url);
  await benPage.getByTestId("mark-0").click(); // Ben marks Amy again
  await benPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await benPage.getByTestId("next-hole").click();
  await benPage.getByTestId("finish-card").click();
  await expect(benPage.getByTestId("submit-total")).toHaveText("46 pts"); // Amy's daily hc is now 10
  await benPage.getByTestId("submit-round").click();

  await expect(orgPage.getByTestId("dg-pts-0")).toHaveText("46", { timeout: 20000 });
  await expect(orgPage.getByTestId("dg-pts-1")).toHaveText("49", { timeout: 20000 });
  await keyAllPar(orgPage, 2); // Cam again
  await expect(orgPage.getByTestId("dg-pts-2")).toHaveText("51");
  // Dee left absent entirely this round
  await orgPage.screenshot({ path: "shots/ft-2-round2-desk-grid.png" });

  await orgPage.getByTestId("complete-round").click(); // confirms the "Dee has no card" dialog
  const r2 = orgPage.getByTestId("daily-results");
  await expect(r2).toBeVisible();
  await expect(orgPage.getByTestId("net-0")).toHaveText("46");
  await expect(orgPage.getByTestId("net-1")).toHaveText("49");
  await expect(orgPage.getByTestId("net-2")).toHaveText("51");
  await expect(orgPage.getByTestId("net-3")).toHaveText("49"); // Dee: field average
  await expect(r2).toContainText("absent");
  // Ben beats Dee on countback despite an equal 49 net (she has no real holes to count back on)
  const r2rows = r2.locator(".row");
  await expect(r2rows.nth(0)).toContainText("Cam Clarke");
  await expect(r2rows.nth(1)).toContainText("Ben Baxter");
  await expect(r2rows.nth(2)).toContainText("Dee Dunn");
  await expect(r2rows.nth(3)).toContainText("Amy Archer");
  await orgPage.screenshot({ path: "shots/ft-3-round2-results.png", fullPage: true });

  // =========================================================== FINAL LEADERBOARD
  await orgPage.getByRole("link", { name: /‹ Round 2/ }).click();
  await orgPage.getByRole("link", { name: /‹ Full Trip Test/ }).click();
  const lb = orgPage.getByTestId("leaderboard");
  const lbRows = lb.locator(".row");
  await expect(lbRows.nth(0)).toContainText("Dee Dunn");
  await expect(lbRows.nth(0)).toContainText("104");
  await expect(lbRows.nth(1)).toContainText("Cam Clarke");
  await expect(lbRows.nth(1)).toContainText("103");
  await expect(lbRows.nth(2)).toContainText("Ben Baxter");
  await expect(lbRows.nth(2)).toContainText("97");
  await expect(lbRows.nth(3)).toContainText("Amy Archer");
  await expect(lbRows.nth(3)).toContainText("90");
  await orgPage.screenshot({ path: "shots/ft-4-final-leaderboard.png", fullPage: true });

  // privacy check: Amy's phone never shows Cam, Dee, or the comp
  await amyPage.goto(`${APP}#/player`);
  await expect(amyPage.getByText("Cam")).toHaveCount(0);
  await expect(amyPage.getByText("Dee")).toHaveCount(0);
  await expect(amyPage.getByText(/10[0-9] pts|leaderboard/i)).toHaveCount(0);

  stub.server.close();
});
