/**
 * New Trip Reset — Office Script for Scoring_Template_V2.xlsx (Excel on the web)
 *
 * Clears the whole trip: roster, courses, every score and penalty — and
 * unhides everything hidden by "Tidy Trip View" / re-unlocks anything locked
 * by "Lock Completed Round".
 *
 * SAFETY CATCH: the script only runs if you first type  RESET  into the
 * Year cell (Setup!B2). Otherwise it does nothing and tells you so.
 * Excel on the web keeps version history if you ever need to undo a reset.
 */
function main(workbook: ExcelScript.Workbook) {
  const MAX_PLAYERS = 32;
  const MAX_ROUNDS = 10;

  const setup = workbook.getWorksheet("Setup");
  const guard = String(setup.getRange("B2").getValue() ?? "").trim().toUpperCase();
  if (guard !== "RESET") {
    console.log('Nothing done. To reset, type RESET into the Year cell (Setup!B2) and run again.');
    return;
  }

  // ---- Setup: trip fields, roster, courses
  setup.getRange("B1").clear(ExcelScript.ClearApplyTo.contents);
  setup.getRange("B2").clear(ExcelScript.ClearApplyTo.contents);
  setup.getRange("B5:E36").clear(ExcelScript.ClearApplyTo.contents);
  for (let r = 0; r < MAX_ROUNDS; r++) {
    setup.getRangeByIndexes(3, 6 + 2 * r, 1, 1).clear(ExcelScript.ClearApplyTo.contents); // course name
  }
  setup.getRange("G6:Z23").clear(ExcelScript.ClearApplyTo.contents); // all par / SI

  // ---- Round sheets: scores + penalties, unhide, unlock entry cells
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const ws = workbook.getWorksheet(`Round ${r}`);
    ws.setVisibility(ExcelScript.SheetVisibility.visible);
    const prot = ws.getProtection();
    if (prot.getProtected()) prot.unprotect();
    for (let p = 0; p < MAX_PLAYERS; p++) {
      const col = 3 + 2 * p; // score column of player p (D, F, H, ...)
      const front = ws.getRangeByIndexes(4, col, 9, 1);   // holes 1-9   (rows 5-13)
      const back = ws.getRangeByIndexes(14, col, 9, 1);   // holes 10-18 (rows 15-23)
      const pen = ws.getRangeByIndexes(25, col, 1, 1);    // penalty     (row 26)
      for (const rng of [front, back, pen]) {
        rng.clear(ExcelScript.ClearApplyTo.contents);
        rng.getFormat().getProtection().setLocked(false);
      }
      ws.getRangeByIndexes(0, col, 1, 2).getEntireColumn().setColumnHidden(false);
    }
    prot.protect();
  }

  // ---- Leaderboard / Handicapping: unhide rows and columns
  const lb = workbook.getWorksheet("Leaderboard");
  const lbProt = lb.getProtection();
  if (lbProt.getProtected()) lbProt.unprotect();
  lb.getRangeByIndexes(2, 0, MAX_PLAYERS, 1).getEntireRow().setRowHidden(false);
  lb.getRangeByIndexes(0, 3, 1, 2 * MAX_ROUNDS).getEntireColumn().setColumnHidden(false);
  lbProt.protect();

  const hc = workbook.getWorksheet("Handicapping");
  const hcProt = hc.getProtection();
  if (hcProt.getProtected()) hcProt.unprotect();
  hc.getRangeByIndexes(3, 0, MAX_PLAYERS, 1).getEntireRow().setRowHidden(false);
  hc.getRangeByIndexes(0, 3, 1, MAX_ROUNDS).getEntireColumn().setColumnHidden(false);
  hc.getRangeByIndexes(39, 0, MAX_PLAYERS, 1).getEntireRow().setRowHidden(false);
  hcProt.protect();

  console.log("Workbook reset — ready for the next trip.");
}
