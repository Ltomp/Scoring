# Golf Trip Scoring — the app

Mobile-first PWA companion to the scoring workbook. Proper marker practice,
digitised: **each player keeps their playing partner's official card** on
their phone (optionally pencilling their own tally alongside to cross-check),
reviews it with them, then presses **Submit round** — only then does the card
count. **Only organisers ever see everyone's scores and the comp.** Same
verified rules as the spreadsheet: individual Stableford, 0/1/2 card
penalties, ranked field-average for absentees, Australian countback
tie-breaks, auto-scaling position-based handicap adjustments. Up to 32
players and 10 rounds per trip; multi-trip with archive.

## How it works

- The app is a static site (GitHub Pages). Trip data lives on the
  **organiser's phone**; each player's phone holds only the card they're
  marking (their partner's) plus their own private tally.
- Cards move through a **drop-box**: a free Supabase project where markers'
  phones upload cards (write-only key) and only the organiser's read-key
  can fetch them. No accounts for anyone; keys travel inside the share links.
- During the round, the partner's card streams up as a **draft** so
  organisers can watch progress; pressing **Submit round** (after checking
  it with the partner, like signing a paper card) marks it official and
  locks it on the marker's phone. Corrections after that go through an
  organiser.
- The morning **round pack** and the **results snapshot** are data
  compressed into a link/QR. Phones scan QRs with the native camera; no
  in-app scanner.
- Score entry works fully offline; drafts and submissions queue until
  there's signal.
- **On a laptop** (≥900px window) the organiser screens switch to a desk
  layout: a spreadsheet-style grid to key every player's card directly
  (like the workbook's scoring sheet), results and handicaps side by side,
  and a two-column trip overview. Same app, same URL — use **Backup trip
  (JSON)** / **Restore trip from backup** to move the comp between phone
  and laptop; cards auto-collect on whichever device is open.

## One-time setup (trip organiser)

1. Create a free project at supabase.com (any name, nearest region).
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), Run.
3. In **Project Settings → API**, copy the *Project URL* and *anon public* key.
4. In the app: Organiser → Start new trip → paste both. Done — every future
   trip reuses them, and nobody else ever configures anything.

Skipping this still works — organisers then key every card by hand.

## Trip flow

| When | Organiser | Players |
| --- | --- | --- |
| Before trip | Create trip: roster + starting h'caps, a course (par/SI) per round | — |
| Each morning | Share the **round pack** link/QR | Tap/scan it, confirm who you are and whose card you're marking |
| During round | Watch draft cards fill in live | Mark your partner's card hole-by-hole; pencil your own tally too if you like |
| After round | Chase any drafts, key paper cards, set penalties, **Complete round** | Check the card with your partner, then **Submit round** |
| Evening | Share the results snapshot to the group chat, if you choose | Read it in the chat |
| Next trip | "Start new trip" (optionally copy roster with finishing h'caps); old trips stay archived | — |

The organiser's **Backup trip (JSON)** button downloads the full trip state;
keep one nightly.

## Development

```bash
cd app
npm install
npm run dev        # local dev server
npm test           # rules engine vs spreadsheet fixtures, codec, outbox
npm run build      # typecheck + production build
npx playwright test  # end-to-end trip flow against a stubbed drop-box
```

The rules engine (`src/engine/`) must stay identical to the verified
workbook model. `python3 ../export_fixtures.py` regenerates
`fixtures/trip-fixture.json` from the same Python model that validates the
Excel template; the Vitest suite fails on any divergence.

Deployment: pushing to the `app` branch runs
`.github/workflows/deploy-app.yml` (tests → build → GitHub Pages). Enable it
once in repo **Settings → Pages → Source: GitHub Actions**. The app then
lives at `https://<owner>.github.io/Scoring/`.

## Trust model & limits

- A marker sees the card they keep — their playing partner's — exactly as
  on paper. Nobody sees the comp except organisers.
- Marker pairs should cover the field (A marks B, B marks A, and so on);
  organisers can key a card for anyone left unmarked.
- Anyone with the app URL could create their own trips against their own
  drop-box; they can't touch yours without your keys.
- One primary organiser device runs the comp (move it via backup
  export/import between phone and laptop); penalties and round completion
  live on that device.
