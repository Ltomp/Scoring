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
  phones upload cards (write key) and only the organiser's read-key can
  fetch the whole field — a marker's write key can also read back just
  their own single card, to check it, never anyone else's. No accounts for
  anyone; keys travel inside the share links.
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
designs for client-side use, and the tables themselves are unreachable via
the anon key except through the SECURITY DEFINER functions in
[`supabase/schema.sql`](supabase/schema.sql). Per-trip write/read keys
still separate players from organisers, but every trip on a shared project
is discoverable by any organiser on that project — see "Trust model &
limits" below before assuming otherwise. The secret `service_role` key is
never used and must never go in this app.

Want your own project instead (or none at all)? On **New trip**, click
**Use my own** next to "Card drop-box":
1. Create a free project at supabase.com, open **SQL Editor**, paste the
   whole of `supabase/schema.sql`, Run.
2. Copy its *Project URL* and *anon public* key from **Project Settings → API**
   into the two fields (or clear both to run with no drop-box — organisers
   then key every card by hand).

Already running your own project from an earlier version of this app? Paste
the whole of `supabase/schema.sql` in again — it's safe to re-run and just
adds the newer tables/functions (currently `gts_trip_state` and the RPCs
that sync roster/courses/penalties across devices; `gts_list_trips`/
`gts_delete_trip` that power automatic trip discovery on `#/org`; and
`gts_organiser_submit_card`/`gts_fetch_own_card` that let organisers
correct a card at any time and let a player read back their own card)
without touching your existing trips or cards. Table-returning functions
whose output columns have changed shape over time (e.g. `gts_fetch_own_card`
gaining `round_completed`) are dropped and recreated explicitly in the
script, since Postgres refuses a plain `create or replace` in that case —
if you ever hit a `cannot change return type` error re-running an older
copy of this file, grab the latest version of `schema.sql` from the repo.

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

Just open **#/org** on the other device (a laptop, a co-organiser's phone) —
every trip on a drop-box project this device knows about (the shared default
one, or any of your own you've used before) just shows up there on its own,
fully hydrated: roster, courses, penalties, completed rounds, cards, the lot.
No link, no QR, no export/import; it keeps syncing both ways from there.

A brand-new device that's never talked to your *own* Supabase project
before still needs one link in first, since there's no other way to hand it
that project's URL/key without accounts: open a trip → **Access this trip on
another device** → scan the QR or send the link. After that, the device
knows about that project and auto-discovers every trip on it, past or
future — this is really only needed once per organiser device, not once per
trip. Trips on the app's shared default drop-box never need even that.

**Backup trip (JSON)** / **Restore trip from backup** still exist as a
manual fallback for trips with no drop-box, or as an extra copy to keep
somewhere safe.

The organiser access link grants full control (scores, penalties, everything)
— only share it with people you actually want running the comp. Deleting a
trip removes it from the drop-box for good, not just from this device —
see "Trust model & limits" below for what that means for who can see it
before it's deleted.

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
  on paper. Nobody sees the comp except organisers. A player can also pull
  up their own card read-only, straight from the drop-box — never anyone
  else's, never the leaderboard — to check what their marker has entered
  for them; only an organiser can actually change it.
- Marker pairs should cover the field (A marks B, B marks A, and so on);
  organisers can key a card for anyone left unmarked.
- Organisers can correct a card at any time, including after **Complete
  round** locks it for players — a marker can't alter their submission
  once the round's locked, but an organiser's fix always goes through and
  reaches every other device.
- **`#/org` auto-discovers every trip on a drop-box project, not just ones
  you were given a link for.** This is deliberate, so organiser devices
  never need a manual handshake — but it means anyone who can reach a
  drop-box project (its URL + public anon key, which ships in the app's
  JS bundle for the shared default one) can see and fully control every
  trip ever registered there, not just their own. There's no per-trip
  secrecy left on a shared project — write/read keys still separate
  players from organisers, but no longer separate one trip from another
  on the same project. If you want a trip's visibility limited to people
  you've specifically told about it, point it at **your own** Supabase
  project instead of the shared default (New Trip → "Use my own") — that
  project's URL/key is never baked into the app, so it's only reachable by
  people you've actually given it to.
- Deleting a trip removes its row (and cards/state) from the drop-box
  entirely — it's gone for whoever else could see it, not just hidden on
  your device.
- Multiple organiser devices can run the same trip at once via auto-sync;
  each pushes its own changes and pulls the others' every time it's open.
  This is deliberately simple last-write-wins syncing (fine for one or two
  organisers making occasional edits), not real-time conflict resolution —
  avoid two people editing the exact same thing at the exact same moment.
