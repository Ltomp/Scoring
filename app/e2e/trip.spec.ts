import { expect, test } from "@playwright/test";
import { startStubDropbox } from "./stub-dropbox.mjs";

/**
 * Full trip happy path:
 * organiser creates a trip with a (stubbed) drop-box, adds 3 players and a
 * course → shares the round pack → a player opens it, scores 18 holes, card
 * auto-syncs → organiser keys a second card from paper, applies a penalty,
 * completes the round → results and leaderboard match hand-computed values.
 *
 * Hand-computed expectations (daily h'caps 10, 6, 15):
 *   Al (10): all par on par-72 easy card, 1 stroke on SI 1-10 -> see below
 *   Bob (6): keyed card
 *   Cec (15): absent -> field average
 */
const APP = "/Scoring/";

let stub: { server: { close(): void }; url: string };
test.beforeAll(async () => {
  stub = await startStubDropbox();
});
test.afterAll(() => stub.server.close());

test("organiser → player → results round trip", async ({ browser }) => {
  const org = await browser.newContext();
  const orgPage = await org.newPage();

  // --- organiser creates trip
  await orgPage.goto(APP);
  await orgPage.getByRole("button", { name: /^Organiser/ }).click();
  await orgPage.getByTestId("new-trip").click();
  await orgPage.getByTestId("trip-name").fill("E2E Cup");
  await orgPage.getByTestId("dropbox-url").fill(stub.url);
  await orgPage.getByTestId("dropbox-key").fill("stub-anon-key");
  await orgPage.getByTestId("create-trip").click();

  // roster
  for (const [name, hcap] of [["Al Alpha", "10"], ["Bob Bravo", "6"], ["Cec Charlie", "15"]] as const) {
    await orgPage.getByTestId("player-name").fill(name);
    await orgPage.getByTestId("player-hcap").fill(hcap);
    await orgPage.getByTestId("add-player").click();
  }
  // round 1 course: pars all 4, SI 1..18
  await orgPage.getByTestId("add-round").click();
  await orgPage.getByTestId("course-name-0").fill("Stub Links");
  await orgPage.getByTestId("course-paste-0").fill(
    `${Array(18).fill(4).join(" ")}\n${Array.from({ length: 18 }, (_, i) => i + 1).join(" ")}`,
  );
  await orgPage.getByTestId("course-save-0").click();
  await orgPage.getByTestId("setup-done").click();

  // --- share round pack
  await orgPage.getByText("Round 1", { exact: false }).first().click();
  await orgPage.getByTestId("share-pack").click();
  const packUrl = await orgPage.getByTestId("share-url").inputValue();
  expect(packUrl).toContain("#/i/");

  // --- player Al opens the pack and scores all 4s (gross par every hole)
  const player = await browser.newContext();
  const playerPage = await player.newPage();
  await playerPage.goto(packUrl);
  await playerPage.getByRole("button", { name: "That's me" }).first().click();
  await playerPage.getByRole("button", { name: /Start my card/ }).click();
  for (let h = 1; h <= 18; h++) {
    // default shown score is par (4); just advance
    await expect(playerPage.getByTestId("score")).toHaveText("4");
    if (h < 18) await playerPage.getByTestId("next-hole").click();
    else await playerPage.getByTestId("finish-card").click();
  }
  // Al: h'cap 10 -> 1 stroke on SI 1-10: 10 holes x 3pts + 8 x 2pts = 46
  await expect(playerPage.getByText("card synced ✓")).toBeVisible({ timeout: 20000 });

  // --- organiser sees Al's card arrive via the drop-box
  await expect(orgPage.getByTestId("card-list")).toContainText("46 pts", { timeout: 20000 });

  // organiser keys Bob's paper card: all 5s (one over par each hole)
  await orgPage.getByRole("button", { name: "key card" }).first().click();
  for (let h = 0; h < 18; h++) await orgPage.getByTestId(`mc-1-${h}`).fill("5");
  await orgPage.getByTestId("mc-save-1").click();
  // Bob: h'cap 6 -> 1 stroke SI 1-6: 6 x 2pts + 12 x 1pt = 24 pts, then pen -1 = 23
  await orgPage.getByTestId("penalty-1").selectOption("1");

  // --- complete round (Cec absent -> avg of 46 and 24 = 35)
  orgPage.on("dialog", (d) => d.accept());
  await orgPage.getByTestId("complete-round").click();

  const results = orgPage.getByTestId("daily-results");
  await expect(results).toBeVisible();
  await expect(orgPage.getByTestId("net-0")).toHaveText("46"); // Al wins
  await expect(orgPage.getByTestId("net-1")).toHaveText("23"); // Bob after penalty
  await expect(orgPage.getByTestId("net-2")).toHaveText("35"); // Cec = field average
  await expect(results).toContainText("absent");
  await expect(results).toContainText("pen");

  // --- leaderboard: Al 1st (46), Cec 2nd (35), Bob 3rd (23)
  await orgPage.getByRole("link", { name: /‹ Round 1/ }).click();
  await orgPage.getByRole("link", { name: /‹ E2E Cup/ }).click();
  const lb = orgPage.getByTestId("leaderboard");
  await expect(lb).toBeVisible();
  const rows = lb.locator(".row");
  await expect(rows.nth(0)).toContainText("Al Alpha");
  await expect(rows.nth(0)).toContainText("46");
  await expect(rows.nth(1)).toContainText("Cec Charlie");
  await expect(rows.nth(2)).toContainText("Bob Bravo");

  // player still sees only their own card — no comp anywhere
  await expect(playerPage.getByText("Bob")).toHaveCount(0);
});
