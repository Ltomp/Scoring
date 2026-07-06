import { expect, test } from "@playwright/test";
import { startStubDropbox } from "./stub-dropbox.mjs";

/**
 * The point of this test: an organiser sets a trip up on one device, then
 * opens it on a SECOND device via "Access this trip on another device" —
 * no JSON export/import at all — and the roster, course and a keyed card
 * are all just there. Then a penalty applied on device 2 shows up back on
 * device 1's round screen. This is what replaces manual JSON backups for
 * day-to-day phone <-> laptop use.
 *
 * Gail: h'cap 11, all-par-4 course, SI 1..18 -> strokes on SI<=11 (11 holes):
 *   11 holes x 3pts + 7 holes x 2pts = 47 points.
 */
const APP = "/Scoring/";

test("organiser access link syncs a trip to a second device with no JSON transfer", async ({ browser }) => {
  test.setTimeout(60000);
  const stub = await startStubDropbox();

  // ---- device 1 (phone): create the trip, roster, course, and key a card
  const dev1 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page1 = await dev1.newPage();
  await page1.goto(`${APP}#/org`);
  await page1.getByTestId("new-trip").click();
  await page1.getByTestId("trip-name").fill("Sync Test Cup");
  await page1.getByRole("button", { name: /Use my own/ }).click();
  await page1.getByTestId("dropbox-url").fill(stub.url);
  await page1.getByTestId("dropbox-key").fill("stub-key");
  await page1.getByTestId("create-trip").click();

  await page1.getByTestId("player-name").fill("Gail Gordon");
  await page1.getByTestId("player-hcap").fill("11");
  await page1.getByTestId("add-player").click();
  await page1.getByTestId("player-name").fill("Hal Hunt");
  await page1.getByTestId("player-hcap").fill("17");
  await page1.getByTestId("add-player").click();

  await page1.getByTestId("add-round").click();
  await page1.getByTestId("course-name-0").fill("Sync Links");
  await page1.getByTestId("course-paste-0").fill(
    `${Array(18).fill(4).join(" ")}\n${Array.from({ length: 18 }, (_, i) => i + 1).join(" ")}`,
  );
  await page1.getByTestId("course-save-0").click();
  await page1.getByTestId("setup-done").click();

  const tripId = page1.url().match(/\/org\/t\/([^/]+)/)![1];

  // key Gail's card on device 1 (mobile per-player editor)
  await page1.getByRole("button", { name: /^Round 1 / }).click();
  await page1.getByRole("button", { name: "key card" }).first().click();
  for (let h = 0; h < 18; h++) await page1.getByTestId(`mc-0-${h}`).fill("4");
  await page1.getByTestId("mc-save-0").click();
  await expect(page1.getByTestId("card-list")).toContainText("47 pts");

  // grab the organiser access link
  await page1.getByRole("link", { name: /‹ Sync Test Cup/ }).click();
  await page1.getByRole("button", { name: /Access this trip on another device/ }).click();
  const accessUrl = await page1.getByTestId("share-url").inputValue();
  expect(accessUrl).toContain("#/i/");

  // ---- device 2 (laptop): open the access link — no import, no upload
  const dev2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await dev2.newPage();
  await page2.goto(accessUrl);

  await page2.getByRole("button", { name: "Setup" }).click();
  await expect(page2.getByText("Gail Gordon").first()).toBeVisible({ timeout: 20000 });
  await expect(page2.getByText("Hal Hunt").first()).toBeVisible();
  await expect(page2.getByText("Sync Links")).toBeVisible();
  await page2.getByTestId("setup-done").click();

  // Gail's keyed card arrived too, via the ordinary card-fetch mechanism
  await page2.getByRole("button", { name: /^Round 1 / }).click();
  await expect(page2.getByTestId("dg-pts-0")).toHaveText("47", { timeout: 20000 });

  // ---- apply a penalty on device 2 (the laptop desk grid)...
  await page2.getByTestId("dg-pen-0").selectOption("2");

  // ...and confirm it flows back to device 1, which is sitting on the same round
  await page1.goto(`${APP}#/org/t/${tripId}/r/1`);
  await expect(page1.getByTestId("penalty-0")).toHaveValue("2", { timeout: 20000 });
});
