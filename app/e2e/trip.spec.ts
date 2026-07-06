import { expect, test } from "@playwright/test";
import { startStubDropbox } from "./stub-dropbox.mjs";

/**
 * Full trip happy path with the marker workflow:
 * organiser creates a trip with a (stubbed) drop-box, adds 3 players and a
 * course → shares the round pack → Al opens it, says who he is, picks Bob
 * as the partner he's marking, scores Bob's 18 holes (drafts auto-sync),
 * reviews and SUBMITS Bob's card → organiser keys Al's own card from paper,
 * applies a penalty to Bob, completes the round → results and leaderboard
 * match hand-computed values.
 *
 * Hand-computed expectations (daily h'caps Al 10, Bob 6, Cec 15; all-par-4
 * course, SI 1..18 in order):
 *   Bob's card (marked by Al): all 4s -> 6 stroke holes x3 + 12 x2 = 42, pen 1 -> 41
 *   Al's card (keyed by organiser): all 4s -> 10 x3 + 8 x2 = 46
 *   Cec absent -> avg of (46, 42) = 44
 */
const APP = "/Scoring/";

let stub: { server: { close(): void }; url: string };
test.beforeAll(async () => {
  stub = await startStubDropbox();
});
test.afterAll(() => stub.server.close());

const PHONE = { viewport: { width: 390, height: 760 } };

test("organiser → player → results round trip", async ({ browser }) => {
  const org = await browser.newContext(PHONE);
  const orgPage = await org.newPage();

  // --- organiser creates trip
  await orgPage.goto(APP);
  await orgPage.getByRole("button", { name: /^Organiser/ }).click();
  await orgPage.getByTestId("new-trip").click();
  await orgPage.getByTestId("trip-name").fill("E2E Cup");
  await orgPage.getByRole("button", { name: /Use my own/ }).click(); // point at the test stub, not the real default
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

  // --- Al opens the pack, identifies himself, and marks Bob's card
  const player = await browser.newContext(PHONE);
  const playerPage = await player.newPage();
  await playerPage.goto(packUrl);
  await playerPage.getByRole("button", { name: "That's me" }).first().click(); // Al
  await playerPage.getByTestId("mark-1").click(); // marking Bob
  await playerPage.getByTestId("open-card").click();
  for (let h = 1; h <= 18; h++) {
    // default shown score is par (4); just advance
    await expect(playerPage.getByTestId("score")).toHaveText("4");
    if (h === 5) {
      // Al also pencils his own tally on one hole
      await playerPage.getByRole("button", { name: "my score one more" }).click();
      await expect(playerPage.getByTestId("tally")).toContainText("4");
    }
    if (h < 18) await playerPage.getByTestId("next-hole").click();
    else await playerPage.getByTestId("finish-card").click();
  }
  // review screen shows Bob's 42 points; nothing is official yet
  await expect(playerPage.getByTestId("submit-total")).toHaveText("42 pts");
  await expect(orgPage.getByTestId("card-list")).toContainText("draft", { timeout: 20000 });

  // Al fixes nothing and presses Submit — the card becomes official
  await playerPage.getByTestId("submit-round").click();
  await expect(playerPage.getByText("delivered ✓")).toBeVisible({ timeout: 20000 });
  await expect(orgPage.getByTestId("card-list")).toContainText("submitted ✓", { timeout: 20000 });
  await expect(orgPage.getByTestId("card-list")).toContainText("42 pts");

  // organiser keys Al's paper card: all 4s -> 46 pts
  await orgPage.getByRole("button", { name: "key card" }).first().click();
  for (let h = 0; h < 18; h++) await orgPage.getByTestId(`mc-0-${h}`).fill("4");
  await orgPage.getByTestId("mc-save-0").click();
  // Bob cops a 1-point card penalty: 42 -> 41
  await orgPage.getByTestId("penalty-1").selectOption("1");

  // --- complete round (Cec absent -> avg of 46 and 42 = 44)
  orgPage.on("dialog", (d) => d.accept());
  await orgPage.getByTestId("complete-round").click();

  const results = orgPage.getByTestId("daily-results");
  await expect(results).toBeVisible();
  await expect(orgPage.getByTestId("net-0")).toHaveText("46"); // Al wins
  await expect(orgPage.getByTestId("net-1")).toHaveText("41"); // Bob after penalty
  await expect(orgPage.getByTestId("net-2")).toHaveText("44"); // Cec = field average
  await expect(results).toContainText("absent");
  await expect(results).toContainText("pen");

  // --- leaderboard: Al 1st (46), Cec 2nd (44), Bob 3rd (41)
  await orgPage.getByRole("link", { name: /‹ Round 1/ }).click();
  await orgPage.getByRole("link", { name: /‹ E2E Cup/ }).click();
  const lb = orgPage.getByTestId("leaderboard");
  await expect(lb).toBeVisible();
  const rows = lb.locator(".row");
  await expect(rows.nth(0)).toContainText("Al Alpha");
  await expect(rows.nth(0)).toContainText("46");
  await expect(rows.nth(1)).toContainText("Cec Charlie");
  await expect(rows.nth(2)).toContainText("Bob Bravo");

  // Al's phone knows Bob (he marked him) but never sees the third player or the comp
  await playerPage.goto(`${APP}#/player`);
  await expect(playerPage.getByText("Cec")).toHaveCount(0);

  // submitted card is locked on the player's phone
  await expect(playerPage.getByText("Card submitted")).toBeVisible();
});

test("laptop organiser keys cards straight into the desk grid", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(APP);
  await page.getByRole("button", { name: /^Organiser/ }).click();
  await page.getByTestId("new-trip").click();
  await page.getByTestId("trip-name").fill("Desk Cup");
  // opt out of the default drop-box entirely: pure keyed-card mode
  await page.getByRole("button", { name: /Use my own/ }).click();
  await page.getByTestId("dropbox-url").fill("");
  await page.getByTestId("dropbox-key").fill("");
  await page.getByTestId("create-trip").click();

  for (const [name, hcap] of [["Dee Delta", "10"], ["Ed Echo", "6"]] as const) {
    await page.getByTestId("player-name").fill(name);
    await page.getByTestId("player-hcap").fill(hcap);
    await page.getByTestId("add-player").click();
  }
  await page.getByTestId("add-round").click();
  await page.getByTestId("course-name-0").fill("Desk Links");
  await page.getByTestId("course-paste-0").fill(
    `${Array(18).fill(4).join(" ")}\n${Array.from({ length: 18 }, (_, i) => i + 1).join(" ")}`,
  );
  await page.getByTestId("course-save-0").click();
  await page.getByTestId("setup-done").click();
  await page.getByText("Round 1", { exact: false }).first().click();

  // the desk grid is visible at laptop width; mobile list is not
  await expect(page.getByTestId("desk-grid")).toBeVisible();
  await expect(page.getByTestId("card-list")).toBeHidden();

  // key Dee's card: all par (4s) -> h'cap 10: 10x3 + 8x2 = 46 pts
  for (let h = 0; h < 18; h++) await page.getByTestId(`dg-0-${h}`).fill("4");
  await expect(page.getByTestId("dg-pts-0")).toHaveText("46");
  // key Ed: all 5s -> h'cap 6: 6x2 + 12x1 = 24, then pen -1 = 23
  for (let h = 0; h < 18; h++) await page.getByTestId(`dg-1-${h}`).fill("5");
  await expect(page.getByTestId("dg-pts-1")).toHaveText("24");
  await page.getByTestId("dg-pen-1").selectOption("1");

  page.on("dialog", (d) => d.accept());
  await page.getByTestId("complete-round").click();
  await expect(page.getByTestId("net-0")).toHaveText("46");
  await expect(page.getByTestId("net-1")).toHaveText("23");
  // desk results show both panels side by side
  await expect(page.getByTestId("daily-results")).toBeVisible();
  await expect(page.getByTestId("hcap-results")).toBeVisible();
});
