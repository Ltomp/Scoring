# Golf Trip Scoring Workbook

A locked-down, formula-driven Excel workbook for scoring golf trip
competitions: daily individual Stableford, a custom position-based trip
handicapping system, and an overall trip leaderboard. Built for **Excel on
the web** (works equally in desktop Excel, LibreOffice and Google Sheets —
only classic spreadsheet functions are used).

> **There's also an app.** The [`app/`](app/) directory (developed on the
> `app` branch) is a mobile PWA that runs the same verified rules: players
> score on their own phones, cards auto-upload to the organiser, and only
> organisers see the comp. See [`app/README.md`](app/README.md).

**The template:** [`Scoring_Template_V2.xlsx`](Scoring_Template_V2.xlsx)

Capacity: up to **32 players** and **10 rounds** per trip. Unused player
slots and rounds are simply left blank and are ignored everywhere.

## Running a trip

Everything you may edit is **yellow**; every other cell is a locked formula.

**Before the trip (Setup sheet)**

1. Enter the trip name and year.
2. Enter each player's name and starting handicap (Golflink no. / nickname
   optional). Leave unused rows completely blank.
3. For each round, enter the course name and every hole's Par and Stroke
   Index. The *SI check* must show **OK** (each of 1–18 used once) and the
   *Par total* is shown for cross-checking the card.

**Each day (Round sheets)** — players fill physical cards; organisers enter
everything:

1. Type each player's gross score per hole into the yellow *Score* cells.
   `0` or blank = wiped hole (no points).
2. If a card was filled out incorrectly, set that player's *Card penalty*
   to 1 or 2. The penalty comes off their round points — affecting their
   daily position, handicap adjustment and the overall comp — but it is
   **not** included when computing the average awarded to absent players.
3. A player with no scores is treated as absent: they receive the field's
   average points for the day (rounded, pre-penalty) and that average is
   ranked like a real score.
4. Points, daily positions and the next day's handicaps update themselves.

**Ties** are split by standard Australian countback: best back 9, then last
6, then last 3, then hole-by-hole from the 18th. `cb` under a player's
position means their tie was decided on countback. (A tie surviving all the
way past hole 13 is shared; an absent player's awarded average carries no
hole scores, so it loses any countback.) Overall leaderboard ties are broken
by countback on the latest round played.

**Handicapping** — after every round each player's trip handicap moves by
the *Amount* for their daily finishing position. The table auto-scales to
the field: top half get cuts, bottom half go up, 0.25 per position step,
capped at ±2. The amounts are yellow — overtype them before the trip if you
want different steps (regenerating the workbook restores the formulas).
Each day's playing handicap is the running handicap rounded to a whole
number; stroke allocation handles handicaps up to 54 (three strokes on the
lowest SI holes).

## Integrity

* All calculation cells are locked; sheets are protected without a password
  (Review → Unprotect Sheet if you ever genuinely need in — not mid-trip).
* Data validation on every input: scores 0–15, penalties 0/1/2, par 3–6,
  SI 1–18, handicaps −5–54; duplicate SIs are flagged red.
* Every round scores against **its own** course's par/SI; every day's
  handicap chains from the previous day's positions. There are no
  hand-maintained links to break.

## Office Scripts (Excel on the web — optional)

Three convenience scripts live in [`office-scripts/`](office-scripts/). The
workbook is fully functional without them. To install each one once:
**Automate → New Script**, delete the stub, paste the file's contents,
rename it, **Save Script**. Then run from Automate → All Scripts (you can
also *Add to workbook* as a button).

| Script | What it does |
| --- | --- |
| `tidy-trip-view.ts` | Hides unused player columns/rows, unused round sheets and their leaderboard columns, based on Setup. Re-run whenever the roster changes. |
| `new-trip-reset.ts` | Clears scores, penalties, roster and courses, and unhides/unlocks everything. Safety catch: type `RESET` into the Year cell first. |
| `lock-completed-round.ts` | Locks the score/penalty cells of every round that has scores, so finished days can't be altered. Run at the end of each day. |

## Development

The workbook is *generated*, not hand-edited:

```
pip install openpyxl
python3 generate_workbook.py        # rebuilds Scoring_Template_V2.xlsx
python3 verify_workbook.py          # needs LibreOffice (headless) on PATH
```

`verify_workbook.py` fills a synthetic trip (12 players, 3 rounds, an
absentee, card penalties, and ties engineered at every countback depth) into
the template, recalculates it with headless LibreOffice, and compares ~950
computed cells against an independent Python implementation of the rules in
the same file. It also checks the blank template recalculates without any
spreadsheet errors. Run it after any change to `generate_workbook.py`.

`archive/Scoring_Template_V_1.01.xlsx` is the original hand-built workbook
this replaces. Known V1 issues fixed here: rounds 2–5 scored against round
1's par/SI; daily handicaps always used the round-1 handicap (adjustments
never flowed through); the leaderboard had broken `#REF!` links and ranges
covering only 9 of 16 players; the adjustment lookup only handled positions
1–9; and most player-name cells were static text rather than roster-linked.
