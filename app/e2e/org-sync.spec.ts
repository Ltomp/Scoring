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

/**
 * The point of this test: a trip that predates trip-state syncing (or whose
 * owning device just hasn't opened it since getting a drop-box) is registered
 * in the drop-box but has no gts_trip_state row yet — this is exactly what
 * happened to a real trip created early in this app's life, before trip-meta
 * syncing existed: #/org discovered it but could only show a confusing empty
 * "(unnamed trip) · 0 players" shell, because there was nothing to hydrate it
 * from. Discovery must not surface a trip at all until it actually has state
 * to show, and once state does appear (e.g. its owning device is finally
 * opened, which now pushes on every view — see TripHome.tsx), the next
 * #/org visit picks it up correctly, with no stuck placeholder ever shown.
 */
test("a trip with no state yet stays invisible on #/org until state appears", async ({ browser }) => {
  test.setTimeout(60000);
  const stub = await startStubDropbox();
  const tripId = "11111111-1111-1111-1111-111111111111";
  const writeKey = "hollow-write-key";
  const readKey = "hollow-read-key";

  // simulate a trip that predates trip-state syncing: registered, no state ever pushed
  await fetch(`${stub.url}/rest/v1/rpc/gts_register_trip`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ p_trip: tripId, p_write_key: writeKey, p_read_key: readKey }),
  });

  // ---- device 1: create an unrelated trip on the same project, just so device 2 learns about it
  const dev1 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page1 = await dev1.newPage();
  await page1.goto(`${APP}#/org`);
  await page1.getByTestId("new-trip").click();
  await page1.getByTestId("trip-name").fill("Anchor Trip");
  await page1.getByRole("button", { name: /Use my own/ }).click();
  await page1.getByTestId("dropbox-url").fill(stub.url);
  await page1.getByTestId("dropbox-key").fill("stub-key");
  await page1.getByTestId("create-trip").click();
  await page1.getByTestId("setup-done").click();
  await page1.getByRole("button", { name: /Access this trip on another device/ }).click();
  const accessUrl = await page1.getByTestId("share-url").inputValue();

  // ---- device 2 adopts the anchor trip (this is how it learns about the project)
  const dev2 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page2 = await dev2.newPage();
  await page2.goto(accessUrl);
  await expect(page2.getByRole("button", { name: /Access this trip on another device/ })).toBeVisible({ timeout: 20000 });

  // the stateless trip is registered on the same project, but stays invisible — no clutter
  await page2.goto(`${APP}#/org`);
  await expect(page2.getByText("Anchor Trip")).toBeVisible({ timeout: 20000 });
  await expect(page2.getByText("(unnamed trip)")).not.toBeVisible();

  // ---- the trip finally gets real state pushed, as if its owning device opened it
  await fetch(`${stub.url}/rest/v1/rpc/gts_save_trip_state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      p_trip: tripId,
      p_key: readKey,
      p_state: { name: "Late Bloomers Cup", year: "2026", players: [{ name: "Ivy Irwin", hcap: 9 }], archived: false, roundsMeta: [] },
    }),
  });

  // ---- device 2 revisits #/org: it appears correctly, first time, no placeholder ever shown
  await page2.goto(`${APP}#/org`);
  await expect(page2.getByText("Late Bloomers Cup")).toBeVisible({ timeout: 20000 });
});

/**
 * The point of this test: a trip that was created (or restored from a JSON
 * backup) with NO drop-box can be connected to one later from Trip Home —
 * this is the recovery path for a trip that lost its drop-box registration.
 * Connecting must push both the trip's setup AND every already-keyed card,
 * not just the roster/courses — otherwise a second device would see the
 * right players but an empty scorecard.
 */
test("connecting a local-only trip to a drop-box pushes its setup and its cards", async ({ browser }) => {
  test.setTimeout(60000);
  const stub = await startStubDropbox();

  // ---- device 1: create a trip with NO drop-box at all, key a card locally
  const dev1 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page1 = await dev1.newPage();
  await page1.goto(`${APP}#/org`);
  await page1.getByTestId("new-trip").click();
  await page1.getByTestId("trip-name").fill("Reconnect Cup");
  await page1.getByRole("button", { name: /Use my own/ }).click();
  await page1.getByTestId("dropbox-url").fill("");
  await page1.getByTestId("dropbox-key").fill("");
  await page1.getByTestId("create-trip").click();

  await page1.getByTestId("player-name").fill("Gail Gordon");
  await page1.getByTestId("player-hcap").fill("11");
  await page1.getByTestId("add-player").click();
  await page1.getByTestId("player-name").fill("Hal Hunt");
  await page1.getByTestId("player-hcap").fill("17");
  await page1.getByTestId("add-player").click();

  await page1.getByTestId("add-round").click();
  await page1.getByTestId("course-name-0").fill("Reconnect Links");
  await page1.getByTestId("course-paste-0").fill(
    `${Array(18).fill(4).join(" ")}\n${Array.from({ length: 18 }, (_, i) => i + 1).join(" ")}`,
  );
  await page1.getByTestId("course-save-0").click();
  await page1.getByTestId("setup-done").click();

  // key Gail's card locally — no drop-box exists yet, so this never leaves the device
  await page1.getByRole("button", { name: /^Round 1 / }).click();
  await page1.getByRole("button", { name: "key card" }).first().click();
  for (let h = 0; h < 18; h++) await page1.getByTestId(`mc-0-${h}`).fill("4");
  await page1.getByTestId("mc-save-0").click();
  await expect(page1.getByTestId("card-list")).toContainText("47 pts");

  // ---- back on Trip Home, connect a drop-box to this now-existing trip
  await page1.getByRole("link", { name: /‹ Reconnect Cup/ }).click();
  await expect(page1.getByTestId("show-connect-dropbox")).toBeVisible();
  await page1.getByTestId("show-connect-dropbox").click();
  await page1.getByTestId("dropbox-url").fill(stub.url);
  await page1.getByTestId("dropbox-key").fill("stub-key");
  await page1.getByTestId("connect-dropbox").click();

  // once connected, the normal access-link UI takes over
  await page1.getByRole("button", { name: /Access this trip on another device/ }).click();
  const accessUrl = await page1.getByTestId("share-url").inputValue();

  // ---- device 2: open the access link — roster, course AND Gail's card all arrive
  const dev2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await dev2.newPage();
  await page2.goto(accessUrl);

  await page2.getByRole("button", { name: "Setup" }).click();
  await expect(page2.getByText("Gail Gordon").first()).toBeVisible({ timeout: 20000 });
  await expect(page2.getByText("Reconnect Links")).toBeVisible();
  await page2.getByTestId("setup-done").click();

  await page2.getByRole("button", { name: /^Round 1 / }).click();
  await expect(page2.getByTestId("dg-pts-0")).toHaveText("47", { timeout: 20000 });
});

/**
 * Regression test: fetchAndMergeCards skipped fetching entirely once a
 * round was marked completed, as an optimisation so a device stops polling
 * a locked round it has already fully fetched. But a round that arrives
 * ALREADY completed via trip-meta sync — exactly what happens connecting an
 * already-finished trip to a drop-box, or discovering one on #/org — had
 * never fetched anything yet, so that same guard meant its cards were never
 * fetched at all: Trip Home showed "completed ✓" with "0/n cards" forever.
 */
test("a round that arrives already-completed with no local cards still fetches them", async ({ browser }) => {
  test.setTimeout(60000);
  const stub = await startStubDropbox();

  // ---- device 1: create a trip with no drop-box, key a card, then COMPLETE the round
  const dev1 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page1 = await dev1.newPage();
  await page1.goto(`${APP}#/org`);
  await page1.getByTestId("new-trip").click();
  await page1.getByTestId("trip-name").fill("Already Done Cup");
  await page1.getByRole("button", { name: /Use my own/ }).click();
  await page1.getByTestId("dropbox-url").fill("");
  await page1.getByTestId("dropbox-key").fill("");
  await page1.getByTestId("create-trip").click();

  await page1.getByTestId("player-name").fill("Gail Gordon");
  await page1.getByTestId("player-hcap").fill("11");
  await page1.getByTestId("add-player").click();

  await page1.getByTestId("add-round").click();
  await page1.getByTestId("course-name-0").fill("Already Done Links");
  await page1.getByTestId("course-paste-0").fill(
    `${Array(18).fill(4).join(" ")}\n${Array.from({ length: 18 }, (_, i) => i + 1).join(" ")}`,
  );
  await page1.getByTestId("course-save-0").click();
  await page1.getByTestId("setup-done").click();
  const tripId = page1.url().match(/\/org\/t\/([^/]+)/)![1];

  await page1.getByRole("button", { name: /^Round 1 / }).click();
  await page1.getByRole("button", { name: "key card" }).first().click();
  for (let h = 0; h < 18; h++) await page1.getByTestId(`mc-0-${h}`).fill("4");
  await page1.getByTestId("mc-save-0").click();
  await expect(page1.getByTestId("card-list")).toContainText("47 pts");
  await page1.getByTestId("complete-round").click(); // round is now completed BEFORE any drop-box exists — navigates to Results
  await expect(page1).toHaveURL(/\/results$/);

  // ---- connect a drop-box now that the round is already locked
  await page1.goto(`${APP}#/org/t/${tripId}`);
  await expect(page1.getByTestId("show-connect-dropbox")).toBeVisible();
  await page1.getByTestId("show-connect-dropbox").click();
  await page1.getByTestId("dropbox-url").fill(stub.url);
  await page1.getByTestId("dropbox-key").fill("stub-key");
  await page1.getByTestId("connect-dropbox").click();
  await expect(page1.getByRole("button", { name: /Access this trip on another device/ })).toBeVisible();

  // ---- device 2 discovers the trip via #/org — never sent a link at all
  const dev2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await dev2.newPage();
  await page2.goto(await accessUrlFor(page1));
  await page2.getByRole("button", { name: "Setup" }).click();
  await expect(page2.getByText("Gail Gordon").first()).toBeVisible({ timeout: 20000 });
  await page2.getByTestId("setup-done").click();

  // the round shows completed AND its card actually arrived — not "0/1 cards"
  await expect(page2.getByText("1/1 cards")).toBeVisible({ timeout: 20000 });
  await page2.getByRole("button", { name: /^Round 1 / }).click();
  await expect(page2.getByTestId("dg-pts-0")).toHaveText("47", { timeout: 20000 });
});

async function accessUrlFor(page: import("@playwright/test").Page): Promise<string> {
  await page.getByRole("button", { name: /Access this trip on another device/ }).click();
  return page.getByTestId("share-url").inputValue();
}

/**
 * The point of this test: organisers are the final authority and must be
 * able to correct a card at any time, even after "Complete round" locks it
 * for players/markers — and that correction has to actually reach other
 * devices, not just this one.
 */
test("an organiser can still correct a card after completing the round, and it syncs elsewhere", async ({ browser }) => {
  test.setTimeout(60000);
  const stub = await startStubDropbox();

  const dev1 = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const page1 = await dev1.newPage();
  await page1.goto(`${APP}#/org`);
  await page1.getByTestId("new-trip").click();
  await page1.getByTestId("trip-name").fill("Correction Cup");
  await page1.getByRole("button", { name: /Use my own/ }).click();
  await page1.getByTestId("dropbox-url").fill(stub.url);
  await page1.getByTestId("dropbox-key").fill("stub-key");
  await page1.getByTestId("create-trip").click();

  await page1.getByTestId("player-name").fill("Gail Gordon");
  await page1.getByTestId("player-hcap").fill("11");
  await page1.getByTestId("add-player").click();

  await page1.getByTestId("add-round").click();
  await page1.getByTestId("course-name-0").fill("Correction Links");
  await page1.getByTestId("course-paste-0").fill(
    `${Array(18).fill(4).join(" ")}\n${Array.from({ length: 18 }, (_, i) => i + 1).join(" ")}`,
  );
  await page1.getByTestId("course-save-0").click();
  await page1.getByTestId("setup-done").click();
  const tripId = page1.url().match(/\/org\/t\/([^/]+)/)![1];

  await page1.getByRole("button", { name: /^Round 1 / }).click();
  await page1.getByRole("button", { name: "key card" }).first().click();
  for (let h = 0; h < 18; h++) await page1.getByTestId(`mc-0-${h}`).fill("4");
  await page1.getByTestId("mc-save-0").click();
  await expect(page1.getByTestId("card-list")).toContainText("47 pts"); // 11 holes x 3pts + 7 holes x 2pts
  await page1.getByTestId("complete-round").click();
  await expect(page1).toHaveURL(/\/results$/);

  // ---- back on the round, "edit card" is still there even though it's completed
  await page1.goto(`${APP}#/org/t/${tripId}/r/1`);
  await expect(page1.getByRole("button", { name: "edit card" })).toBeVisible();
  await page1.getByRole("button", { name: "edit card" }).click();
  await page1.getByTestId("mc-0-0").fill("5"); // hole 1 (SI 1): one worse -> 47 becomes 46
  await page1.getByTestId("mc-save-0").click();
  await expect(page1.getByTestId("card-list")).toContainText("46 pts");

  // ---- a second device sees the correction, not the original 47
  await page1.goto(`${APP}#/org/t/${tripId}`);
  const dev2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page2 = await dev2.newPage();
  await page2.goto(await accessUrlFor(page1));
  await page2.getByRole("button", { name: /^Round 1 / }).click();
  await expect(page2.getByTestId("dg-pts-0")).toHaveText("46", { timeout: 20000 });
});

/**
 * The point of this test: a player can review their OWN official card
 * (the one their marking partner is keeping for them) read-only, straight
 * from the drop-box — without ever gaining access to anyone else's card or
 * the comp. This is distinct from their private "tally", which never
 * leaves their own phone.
 */
test("a player can review their own scores read-only, as recorded by their marker", async ({ browser }) => {
  test.setTimeout(60000);
  const stub = await startStubDropbox();

  const org = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const orgPage = await org.newPage();
  await orgPage.goto(`${APP}#/org`);
  await orgPage.getByTestId("new-trip").click();
  await orgPage.getByTestId("trip-name").fill("Review Cup");
  await orgPage.getByRole("button", { name: /Use my own/ }).click();
  await orgPage.getByTestId("dropbox-url").fill(stub.url);
  await orgPage.getByTestId("dropbox-key").fill("stub-key");
  await orgPage.getByTestId("create-trip").click();

  for (const [name, hcap] of [["Amy Archer", "8"], ["Ben Baxter", "12"]] as const) {
    await orgPage.getByTestId("player-name").fill(name);
    await orgPage.getByTestId("player-hcap").fill(hcap);
    await orgPage.getByTestId("add-player").click();
  }
  await orgPage.getByTestId("add-round").click();
  await orgPage.getByTestId("course-name-0").fill("Review Links");
  await orgPage.getByTestId("course-paste-0").fill(
    `${Array(18).fill(4).join(" ")}\n${Array.from({ length: 18 }, (_, i) => i + 1).join(" ")}`,
  );
  await orgPage.getByTestId("course-save-0").click();
  await orgPage.getByTestId("setup-done").click();

  await orgPage.getByRole("button", { name: /^Round 1 / }).click();
  await orgPage.getByTestId("share-pack").click();
  const packUrl = await orgPage.getByTestId("share-url").inputValue();

  // ---- Amy marks Ben, keys every hole at par, submits
  const amy = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const amyPage = await amy.newPage();
  await amyPage.goto(packUrl);
  await amyPage.getByRole("button", { name: "That's me" }).nth(0).click();
  await amyPage.getByTestId("mark-1").click(); // marking Ben
  await amyPage.getByTestId("open-card").click();
  for (let h = 1; h <= 17; h++) await amyPage.getByTestId("next-hole").click();
  await amyPage.getByTestId("finish-card").click();
  await amyPage.getByTestId("submit-round").click();

  // ---- Ben opens the same pack and reviews HIS OWN scores, read-only
  const ben = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const benPage = await ben.newPage();
  await benPage.goto(packUrl);
  await benPage.getByRole("button", { name: "That's me" }).nth(1).click();
  await benPage.getByTestId("mark-0").click(); // Ben marks Amy — irrelevant to this test
  await benPage.getByTestId("review-mine").click();

  await expect(benPage.getByText(/pts$/)).toBeVisible({ timeout: 20000 });
  await expect(benPage.getByText("Submitted by your marker")).toBeVisible();
  await expect(benPage.locator(".hs.done").first()).toContainText("4"); // Amy keyed par (4) on every hole
});
