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
  and a two-column trip overview.
- **Any organiser device can pick up a trip automatically** — no JSON
  export/import needed. Roster, courses, penalties and round-completion
  all sync through the drop-box (not just cards), so opening the same
  trip's **organiser access link** on a laptop, or a co-organiser's phone,
  pulls everything straight down and keeps it live from there.

## Setup

None needed — a shared drop-box (`src/dropboxConfig.ts`) is baked into the
app, so **Start new trip** just works. That file holds a Supabase *project
URL* and its **anon (public) key** — safe to commit; it's the key Supabase
designs for client-side use, and the actual security boundary is the
per-trip write/read keys minted at trip creation and enforced by the
SECURITY DEFINER functions in [`supabase/schema.sql`](supabase/schema.sql)
(the tables themselves are unreachable via the anon key). The secret
`service_role` key is never used and must never go in this app.

Want your own project instead (or none at all)? On **New trip**, click
**Use my own** next to "Card drop-box":
1. Create a free project at supabase.com, open **SQL Editor**, paste the
   whole of `supabase/schema.sql`, Run.
2. Copy its *Project URL* and *anon public* key from **Project Settings → API**
   into the two fields (or clear both to run with no drop-box — organisers
   then key every card by hand).

Already running your own project from an earlier version of this app? Paste
the whole of `supabase/schema.sql` in again — every statement is
idempotent (`create table if not exists`, `create or replace function`), so
re-running it is safe and just adds the newer tables/functions (currently
`gts_trip_state` + the two RPCs that sync roster/courses/penalties across
devices) without touching your existing trips or cards.

## Trip flow

| When | Organiser | Players |
| --- | --- | --- |
| Before trip | Create trip: roster + starting h'caps, a course (par/SI) per round | — |
| Each morning | Share the **round pack** link/QR | Tap/scan it, confirm who you are and whose card you're marking |
| During round | Watch draft cards fill in live | Mark your partner's card hole-by-hole; pencil your own tally too if you like |
| After round | Chase any drafts, key paper cards, set penalties, **Complete round** | Check the card with your partner, then **Submit round** |
| Evening | Share the results snapshot to the group chat, if you choose | Read it in the chat |
| Next trip | "Start new trip" (optionally copy roster with finishing h'caps); old trips stay archived | — |

### Running the comp from more than one device

Open a trip → **Access this trip on another device** → scan the QR or send
the link. Whoever opens it (a laptop, a co-organiser's phone) gets the full
trip automatically — roster, courses, penalties, completed rounds, cards,
the lot — and it keeps syncing both ways from there while the trip has a
drop-box configured. This is the normal way to move between your phone at
the course and a laptop back at the house; **Backup trip (JSON)** /
**Restore trip from backup** still exist as a manual fallback for trips
with no drop-box, or as an extra copy to keep somewhere safe.

The organiser access link grants full control (scores, penalties, everything)
— only share it with people you actually want running the comp.

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
- Every trip gets its own random write/read keys, even ones sharing the
  default drop-box — one trip's keys can't read another trip's cards.
  Anyone can also point their own trip at their own Supabase project.
- Multiple organiser devices can run the same trip at once via the access
  link; each pushes its own changes and pulls the others' every time it's
  open. This is deliberately simple last-write-wins syncing (fine for one
  or two organisers making occasional edits), not real-time conflict
  resolution — avoid two people editing the exact same thing at the exact
  same moment.
