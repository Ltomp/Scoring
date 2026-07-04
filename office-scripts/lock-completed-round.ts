/**
 * Lock Completed Round — Office Script for Scoring_Template_V2.xlsx (Excel on the web)
 *
 * Locks the score and penalty cells of every Round sheet that already has at
 * least one score entered, so a completed day's comp can't be changed by
 * accident. Run it at the end of each day, after all cards are entered.
 *
 * To correct a card afterwards: Review > Unprotect Sheet on that round,
 * fix the score, then run this script again.
 * "New Trip Reset" unlocks everything for the next trip.
 */
function main(workbook: ExcelScript.Workbook) {
  const MAX_PLAYERS = 32;
  const MAX_ROUNDS = 10;
  const locked: number[] = [];

  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const ws = workbook.getWorksheet(`Round ${r}`);
    // any score anywhere in the score/pts grid? (pts are 0 unless a score exists)
    const values = ws.getRange("D5:BO23").getValues();
    let hasScores = false;
    for (let p = 0; p < MAX_PLAYERS && !hasScores; p++) {
      for (const row of [...Array(9).keys(), ...[...Array(9).keys()].map(i => i + 10)]) {
        const v = values[row][2 * p];
        if (typeof v === "number" && v > 0) { hasScores = true; break; }
      }
    }
    if (!hasScores) continue;

    const prot = ws.getProtection();
    if (prot.getProtected()) prot.unprotect();
    for (let p = 0; p < MAX_PLAYERS; p++) {
      const col = 3 + 2 * p; // score column of player p
      ws.getRangeByIndexes(4, col, 9, 1).getFormat().getProtection().setLocked(true);
      ws.getRangeByIndexes(14, col, 9, 1).getFormat().getProtection().setLocked(true);
      ws.getRangeByIndexes(25, col, 1, 1).getFormat().getProtection().setLocked(true);
    }
    prot.protect();
    locked.push(r);
  }

  console.log(locked.length
    ? `Locked rounds: ${locked.join(", ")}`
    : "No rounds have scores yet — nothing locked.");
}
