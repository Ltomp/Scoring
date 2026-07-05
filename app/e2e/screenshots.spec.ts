import { test } from "@playwright/test";
import { startStubDropbox } from "./stub-dropbox.mjs";

// Not a test — produces screenshots of the key screens for review.
// Run: npx playwright test screenshots --grep @shots
const APP = "/Scoring/";
const OUT = process.env.SHOTS_DIR ?? "shots";

test("capture key screens @shots", async ({ browser }) => {
  test.setTimeout(120000);
  const stub = await startStubDropbox();
  const org = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const orgPage = await org.newPage();

  await orgPage.goto(APP);
  await orgPage.screenshot({ path: `${OUT}/1-home.png` });

  await orgPage.getByRole("button", { name: /^Organiser/ }).click();
  await orgPage.getByTestId("new-trip").click();
  await orgPage.getByTestId("trip-name").fill("Peninsula Trip");
  await orgPage.getByTestId("dropbox-url").fill(stub.url);
  await orgPage.getByTestId("dropbox-key").fill("anon-key");
  await orgPage.getByTestId("create-trip").click();

  const roster: [string, string][] = [
    ["Attiwill, Scott", "14"], ["Hoy, John", "8"], ["Ireland, Kev", "12"],
    ["Maher, Joel", "16"], ["McEwan, Paul", "21"], ["O'Callaghan, Joc", "14"],
    ["Rettke, Butch", "18"], ["Tompkins, Lawrie", "15"],
  ];
  for (const [name, hcap] of roster) {
    await orgPage.getByTestId("player-name").fill(name);
    await orgPage.getByTestId("player-hcap").fill(hcap);
    await orgPage.getByTestId("add-player").click();
  }
  await orgPage.getByTestId("add-round").click();
  await orgPage.getByTestId("course-name-0").fill("The Dunes Golf Links");
  await orgPage.getByTestId("course-paste-0").fill(
    "4 4 3 5 4 3 4 5 4 4 3 5 4 4 4 3 5 4\n16 10 2 4 6 8 12 15 18 1 14 13 17 11 7 9 5 3",
  );
  await orgPage.getByTestId("course-save-0").click();
  await orgPage.screenshot({ path: `${OUT}/5-setup.png`, fullPage: true });
  await orgPage.getByTestId("setup-done").click();

  await orgPage.getByText("Round 1", { exact: false }).first().click();
  await orgPage.getByTestId("share-pack").click();
  const packUrl = await orgPage.getByTestId("share-url").inputValue();
  await orgPage.screenshot({ path: `${OUT}/6-share-pack.png` });

  // player scores
  const player = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const playerPage = await player.newPage();
  await playerPage.goto(packUrl);
  await playerPage.getByRole("button", { name: "That's me" }).last().click();
  await playerPage.getByRole("button", { name: /Start my card/ }).click();
  const card = [5, 4, 4, 6, 5, 3, 4, 7, 4, 5, 3, 6, 4, 5, 4, 4, 6, 5];
  for (let h = 0; h < 18; h++) {
    const delta = card[h] - [4, 4, 3, 5, 4, 3, 4, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4][h];
    const btn = delta > 0 ? "one more" : "one less";
    for (let i = 0; i < Math.abs(delta); i++)
      await playerPage.getByRole("button", { name: btn }).click();
    if (h === 7) await playerPage.screenshot({ path: `${OUT}/2-score-entry.png` });
    if (h < 17) await playerPage.getByTestId("next-hole").click();
    else await playerPage.getByTestId("finish-card").click();
  }
  await playerPage.screenshot({ path: `${OUT}/3-player-today.png` });
  await playerPage.goto(`${APP}#/player/handin`);
  await playerPage.screenshot({ path: `${OUT}/4-handin.png` });

  // organiser dashboard with one card in + penalty
  await orgPage.getByTestId("share-pack").click(); // hide pack
  await orgPage.waitForSelector("text=/18 holes/", { timeout: 20000 });
  await orgPage.getByTestId("penalty-4").selectOption("1");
  await orgPage.screenshot({ path: `${OUT}/7-dashboard.png` });

  orgPage.on("dialog", (d) => d.accept());
  await orgPage.getByTestId("complete-round").click();
  await orgPage.waitForSelector('[data-testid="daily-results"]');
  await orgPage.screenshot({ path: `${OUT}/8-results.png`, fullPage: true });

  await orgPage.getByRole("link", { name: /‹ Round 1/ }).click();
  await orgPage.getByRole("link", { name: /‹ Peninsula Trip/ }).click();
  await orgPage.screenshot({ path: `${OUT}/9-leaderboard.png`, fullPage: true });

  stub.server.close();
});

test("capture laptop organiser screens @shots", async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(APP);
  await page.getByRole("button", { name: /^Organiser/ }).click();
  await page.getByTestId("new-trip").click();
  await page.getByTestId("trip-name").fill("Peninsula Trip");
  await page.getByTestId("create-trip").click();

  const roster: [string, string][] = [
    ["Attiwill, Scott", "14"], ["Hoy, John", "8"], ["Ireland, Kev", "12"],
    ["Maher, Joel", "16"], ["McEwan, Paul", "21"], ["O'Callaghan, Joc", "14"],
    ["Rettke, Butch", "18"], ["Tompkins, Lawrie", "15"],
  ];
  for (const [name, hcap] of roster) {
    await page.getByTestId("player-name").fill(name);
    await page.getByTestId("player-hcap").fill(hcap);
    await page.getByTestId("add-player").click();
  }
  await page.getByTestId("add-round").click();
  await page.getByTestId("course-name-0").fill("The Dunes Golf Links");
  await page.getByTestId("course-paste-0").fill(
    "4 4 3 5 4 3 4 5 4 4 3 5 4 4 4 3 5 4\n16 10 2 4 6 8 12 15 18 1 14 13 17 11 7 9 5 3",
  );
  await page.getByTestId("course-save-0").click();
  await page.getByTestId("setup-done").click();
  await page.getByText("Round 1", { exact: false }).first().click();

  // key a few cards straight into the grid
  const cards = [
    [5, 4, 4, 6, 5, 3, 4, 7, 4, 5, 3, 6, 4, 5, 4, 4, 6, 5],
    [4, 5, 3, 5, 6, 4, 5, 6, 5, 4, 4, 7, 5, 5, 4, 3, 6, 4],
    [6, 5, 4, 7, 5, 4, 5, 6, 4, 6, 4, 6, 5, 5, 5, 4, 7, 5],
  ];
  for (let p = 0; p < cards.length; p++)
    for (let h = 0; h < 18; h++)
      await page.getByTestId(`dg-${p}-${h}`).fill(String(cards[p][h]));
  await page.getByTestId("dg-pen-2").selectOption("1");
  await page.screenshot({ path: `${OUT}/L1-desk-dashboard.png` });

  page.on("dialog", (d) => d.accept());
  await page.getByTestId("complete-round").click();
  await page.waitForSelector('[data-testid="daily-results"]');
  await page.screenshot({ path: `${OUT}/L2-desk-results.png` });

  await page.getByRole("link", { name: /‹ Round 1/ }).click();
  await page.getByRole("link", { name: /‹ Peninsula Trip/ }).click();
  await page.screenshot({ path: `${OUT}/L3-desk-triphome.png` });
});
