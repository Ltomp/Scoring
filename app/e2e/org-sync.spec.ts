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

/**
 * The point of this test: #/org auto-discovers every trip on a drop-box
 * project it knows about — not just ones it was handed a link for. Device 2
 * only ever gets a link for Trip A; Trip B is created independently by a
 * third device on the SAME stub project and never shared with device 2 at
 * all, yet it just appears on device 2's #/org. Deleting it then removes it
 * from the drop-box for good, so it doesn't come back.
 */
test("a trip nobody sent a link for still shows up on #/org, and Delete removes it for good", async ({ browser }) => {
  test.setTimeout(60000);
  const stub = await startStubDropbox();

  // ---- device 1: create Trip A and grab its access link for device 2 only
  const dev1 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page1 = await dev1.newPage();
  await page1.goto(`${APP}#/org`);
  await page1.getByTestId("new-trip").click();
  await page1.getByTestId("trip-name").fill("Trip A");
  await page1.getByRole("button", { name: /Use my own/ }).click();
  await page1.getByTestId("dropbox-url").fill(stub.url);
  await page1.getByTestId("dropbox-key").fill("stub-key");
  await page1.getByTestId("create-trip").click();
  await page1.getByTestId("setup-done").click();

  await page1.getByRole("button", { name: /Access this trip on another device/ }).click();
  const accessUrl = await page1.getByTestId("share-url").inputValue();

  // ---- device 2: adopt Trip A via the link (this is how it learns about the stub project)
  const dev2 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page2 = await dev2.newPage();
  await page2.goto(accessUrl);
  await expect(page2.getByRole("button", { name: /Access this trip on another device/ })).toBeVisible({ timeout: 20000 });

  // ---- device 3: an unrelated organiser creates Trip B on the SAME project — no link ever shared
  const dev3 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page3 = await dev3.newPage();
  await page3.goto(`${APP}#/org`);
  await page3.getByTestId("new-trip").click();
  await page3.getByTestId("trip-name").fill("Trip B");
  await page3.getByRole("button", { name: /Use my own/ }).click();
  await page3.getByTestId("dropbox-url").fill(stub.url);
  await page3.getByTestId("dropbox-key").fill("stub-key");
  await page3.getByTestId("create-trip").click();
  await page3.getByTestId("setup-done").click();

  // ---- device 2 revisits #/org — Trip B is just there, automatically
  await page2.goto(`${APP}#/org`);
  await expect(page2.getByText("Trip B")).toBeVisible({ timeout: 20000 });

  // ---- delete Trip B from device 2 and confirm it doesn't reappear
  page2.on("dialog", (d) => d.accept());
  await page2.getByText("Trip B").click();
  await page2.getByRole("button", { name: /Archive trip/ }).click();
  await page2.goto(`${APP}#/org`);
  await expect(page2.getByText("Trip B")).toBeVisible({ timeout: 20000 }); // now in the archive list
  await page2.getByRole("button", { name: "Delete" }).click();
  await expect(page2.getByText("Trip B")).not.toBeVisible();

  await page2.goto(`${APP}#/org`);
  await expect(page2.getByText("Trip B")).not.toBeVisible({ timeout: 20000 }); // gone from the drop-box, not just hidden locally
});
