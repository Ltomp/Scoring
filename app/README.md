# Golf Trip Scoring — the app

Mobile-first PWA companion to the scoring workbook. Players enter their own
scores on their phones; **only organisers ever see everyone's scores and the
comp**. Same verified rules as the spreadsheet: individual Stableford,
0/1/2 card penalties, ranked field-average for absentees, Australian
countback tie-breaks, auto-scaling position-based handicap adjustments.
Up to 32 players and 10 rounds per trip; multi-trip with archive.

## How it works

- The app is a static site (GitHub Pages). Trip data lives on the
  **organiser's phone**; each player's phone holds **only their own card**.
- Cards move through a **drop-box**: a free Supabase project where players'
  phones auto-upload scores (write-only key) and only the organiser's
  read-key can fetch them. No accounts for anyone; keys travel inside the
  share links.
- Everything shared — the morning **round pack**, the offline **card
  hand-in**, the **results snapshot** — is data compressed into a link/QR.
  Phones scan QRs with the native camera; no in-app scanner.
- Score entry works fully offline; uploads queue until there's signal, and
  the QR hand-in covers a dead battery or zero reception.

## One-time setup (trip organiser)

1. Create a free project at supabase.com (any name, nearest region).
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), Run.
3. In **Project Settings → API**, copy the *Project URL* and *anon public* key.
4. In the app: Organiser → Start new trip → paste both. Done — every future
   trip reuses them, and nobody else ever configures anything.

Skipping this still works — the app then runs on QR hand-ins alone.

## Trip flow

| When | Organiser | Players |
| --- | --- | --- |
| Before trip | Create trip: roster + starting h'caps, a course (par/SI) per round | — |
| Each morning | Share the **round pack** link/QR | Tap/scan it — today's card configures itself |
| During round | Watch cards fill in live | Enter scores hole-by-hole (own card only) |
| After round | Key any paper cards, set penalties, **Complete round** | Hand in by QR only if asked |
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

- A card share-link is readable by anyone it's forwarded to — same as
  handing over a paper card.
- Anyone with the app URL could create their own trips against their own
  drop-box; they can't touch yours without your keys.
- One primary organiser device runs the comp (move it via backup
  export/import). A second organiser can accept QR hand-ins, but penalties
  and round completion live on the primary device.
