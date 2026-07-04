/**
 * Tidy Trip View — Office Script for Scoring_Template_V2.xlsx (Excel on the web)
 *
 * Reads the Setup sheet and hides everything not used by the current trip:
 *   - player columns on every Round sheet for empty roster slots
 *   - player rows on the Leaderboard and Handicapping sheets
 *   - Round sheets (and their Leaderboard/Handicapping columns) with no course entered
 *   - adjustment-table rows beyond the number of players
 *
 * Re-run it any time the roster or courses change. Run "New Trip Reset" to
 * unhide everything.
 */
function main(workbook: ExcelScript.Workbook) {
  const MAX_PLAYERS = 32;
  const MAX_ROUNDS = 10;

  const setup = workbook.getWorksheet("Setup");
  const nameValues = setup.getRange("B5:B36").getValues();
  const slotUsed: boolean[] = nameValues.map(row => String(row[0] ?? "").trim() !== "");
  const playerCount = slotUsed.filter(u => u).length;

  const roundUsed: boolean[] = [];
  for (let r = 0; r < MAX_ROUNDS; r++) {
    // course names live in row 4, columns G,I,K,... (merged pairs)
    const course = setup.getRangeByIndexes(3, 6 + 2 * r, 1, 1).getValue();
    roundUsed.push(String(course ?? "").trim() !== "");
  }

  // ---- Round sheets: visibility + player columns
  for (let r = 0; r < MAX_ROUNDS; r++) {
    const ws = workbook.getWorksheet(`Round ${r + 1}`);
    if (!roundUsed[r]) {
      ws.setVisibility(ExcelScript.SheetVisibility.hidden);
      continue;
    }
    ws.setVisibility(ExcelScript.SheetVisibility.visible);
    const prot = ws.getProtection();
    if (prot.getProtected()) prot.unprotect();
    for (let p = 0; p < MAX_PLAYERS; p++) {
      // player p occupies two columns starting at D (index 3)
      ws.getRangeByIndexes(0, 3 + 2 * p, 1, 2)
        .getEntireColumn()
        .setColumnHidden(!slotUsed[p]);
    }
    prot.protect();
  }

  // ---- Leaderboard: player rows + unused round columns
  const lb = workbook.getWorksheet("Leaderboard");
  const lbProt = lb.getProtection();
  if (lbProt.getProtected()) lbProt.unprotect();
  for (let p = 0; p < MAX_PLAYERS; p++) {
    lb.getRangeByIndexes(2 + p, 0, 1, 1).getEntireRow().setRowHidden(!slotUsed[p]);
  }
  for (let r = 0; r < MAX_ROUNDS; r++) {
    // Rd r points/pos pair starts at column D (index 3) for round 1
    lb.getRangeByIndexes(0, 3 + 2 * r, 1, 2)
      .getEntireColumn()
      .setColumnHidden(!roundUsed[r]);
  }
  lbProt.protect();

  // ---- Handicapping: player rows, unused round columns, adjustment rows
  const hc = workbook.getWorksheet("Handicapping");
  const hcProt = hc.getProtection();
  if (hcProt.getProtected()) hcProt.unprotect();
  for (let p = 0; p < MAX_PLAYERS; p++) {
    hc.getRangeByIndexes(3 + p, 0, 1, 1).getEntireRow().setRowHidden(!slotUsed[p]);
  }
  for (let r = 0; r < MAX_ROUNDS; r++) {
    // Rd columns D..M (index 3..12)
    hc.getRangeByIndexes(0, 3 + r, 1, 1).getEntireColumn().setColumnHidden(!roundUsed[r]);
  }
  for (let pos = 1; pos <= MAX_PLAYERS; pos++) {
    // adjustment table rows 40..71
    hc.getRangeByIndexes(39 + pos - 1, 0, 1, 1).getEntireRow().setRowHidden(pos > playerCount);
  }
  hcProt.protect();

  console.log(`Tidied: ${playerCount} players, rounds in use: ${roundUsed
    .map((u, i) => (u ? i + 1 : 0)).filter(x => x > 0).join(", ") || "none"}`);
}
