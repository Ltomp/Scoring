-- Golf Trip Scoring — drop-box schema.
-- Paste this once into your Supabase project's SQL Editor and run it.
--
-- Privacy model: the tables are completely inaccessible to the public anon
-- key (RLS enabled, no policies). ALL access goes through the SECURITY
-- DEFINER functions below, which check the trip's write/read keys:
--   * players hold only the write key -> can submit their own card, and
--     can read back only their own single card via gts_fetch_own_card
--     (never the whole field or the comp)
--   * organisers hold the read key -> can read every card and manage
--     rounds, and can correct a card via gts_organiser_submit_card at any
--     time, even after the round is completed (players/markers are
--     locked out of gts_submit_card once a round is completed; only an
--     organiser correction bypasses that)
--   * gts_list_trips is the one deliberate exception: it takes no key at
--     all, so #/org can auto-discover every trip on this project. Anyone
--     who can reach this project (i.e. has this URL + anon key) can see
--     and control every trip registered here. Use your own project if
--     you want a trip's visibility limited to people you've told about it.

create table if not exists public.gts_trips (
  id uuid primary key,
  write_key text not null,
  read_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.gts_cards (
  trip_id uuid not null references public.gts_trips (id) on delete cascade,
  round int not null check (round between 1 and 10),
  player int not null check (player between 0 and 31),
  name text not null default '',
  scores jsonb not null,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (trip_id, round, player)
);

create table if not exists public.gts_completed (
  trip_id uuid not null references public.gts_trips (id) on delete cascade,
  round int not null,
  primary key (trip_id, round)
);

-- Trip metadata (roster, courses, penalties, which rounds are complete) so
-- an organiser can pick a trip up on a second device without a JSON
-- export/import. Scores themselves stay out of here — they're already
-- covered by gts_cards above; this table is deliberately small.
create table if not exists public.gts_trip_state (
  trip_id uuid primary key references public.gts_trips (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.gts_trips enable row level security;
alter table public.gts_cards enable row level security;
alter table public.gts_completed enable row level security;
alter table public.gts_trip_state enable row level security;
-- no policies: tables are unreachable except via the functions below

-- Called by the organiser app when a trip is created.
create or replace function public.gts_register_trip(
  p_trip uuid, p_write_key text, p_read_key text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into gts_trips (id, write_key, read_key)
  values (p_trip, p_write_key, p_read_key)
  on conflict (id) do nothing;
end $$;

-- Called by player apps as they score (and by the hand-in fallback import).
create or replace function public.gts_submit_card(
  p_trip uuid, p_key text, p_round int, p_player int,
  p_name text, p_scores jsonb, p_done boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.write_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  if exists (select 1 from gts_completed c where c.trip_id = p_trip and c.round = p_round) then
    raise exception 'round completed';
  end if;
  insert into gts_cards (trip_id, round, player, name, scores, done, updated_at)
  values (p_trip, p_round, p_player, p_name, p_scores, p_done, now())
  on conflict (trip_id, round, player) do update
    set name = excluded.name, scores = excluded.scores,
        done = excluded.done, updated_at = now();
end $$;

-- Called by the organiser app to key/correct a card directly — unlike
-- gts_submit_card, this is NOT blocked once the round is completed, since
-- an organiser is the final authority and needs to be able to fix a card
-- at any time. Read-key gated (organiser only), never used by players.
create or replace function public.gts_organiser_submit_card(
  p_trip uuid, p_key text, p_round int, p_player int,
  p_name text, p_scores jsonb, p_done boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.read_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  insert into gts_cards (trip_id, round, player, name, scores, done, updated_at)
  values (p_trip, p_round, p_player, p_name, p_scores, p_done, now())
  on conflict (trip_id, round, player) do update
    set name = excluded.name, scores = excluded.scores,
        done = excluded.done, updated_at = now();
end $$;

-- Called by a player's own device to review their own scores, read-only —
-- write-key gated like gts_submit_card (a marker's phone already holds the
-- same trip-wide write key regardless of which player it's acting for, so
-- this doesn't weaken anything: any write-key holder could already submit
-- scores for any player; this just lets it read one card back the same
-- way). Only ever returns the single (round, player) card asked for, never
-- the whole field or the comp — organisers alone hold the read key.
create or replace function public.gts_fetch_own_card(
  p_trip uuid, p_key text, p_round int, p_player int
) returns table (scores jsonb, done boolean, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.write_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  return query
    select c.scores, c.done, c.updated_at
    from gts_cards c
    where c.trip_id = p_trip and c.round = p_round and c.player = p_player;
end $$;

-- Called by the organiser app to collect cards.
create or replace function public.gts_fetch_cards(
  p_trip uuid, p_key text, p_round int default null
) returns table (round int, player int, name text, scores jsonb, done boolean, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.read_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  return query
    select c.round, c.player, c.name, c.scores, c.done, c.updated_at
    from gts_cards c
    where c.trip_id = p_trip and (p_round is null or c.round = p_round);
end $$;

-- Called by the organiser app when completing (or reopening) a round.
create or replace function public.gts_complete_round(
  p_trip uuid, p_key text, p_round int, p_completed boolean
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.read_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  if p_completed then
    insert into gts_completed (trip_id, round) values (p_trip, p_round)
    on conflict do nothing;
  else
    delete from gts_completed where trip_id = p_trip and round = p_round;
  end if;
end $$;

-- Called by any organiser device whenever roster/courses/penalties/round
-- completion change, so another device can pick the trip up.
create or replace function public.gts_save_trip_state(
  p_trip uuid, p_key text, p_state jsonb
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.read_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  insert into gts_trip_state (trip_id, state, updated_at)
  values (p_trip, p_state, now())
  on conflict (trip_id) do update set state = excluded.state, updated_at = now();
end $$;

-- Called when opening a trip (or an "organiser access" link on a new device).
create or replace function public.gts_load_trip_state(
  p_trip uuid, p_key text
) returns table (state jsonb, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.read_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  return query select s.state, s.updated_at from gts_trip_state s where s.trip_id = p_trip;
end $$;

-- Deliberately unauthenticated (no key argument): lets #/org auto-discover
-- every trip registered against this drop-box project without a link/QR
-- handshake first. This is a trust-model choice, not an oversight — see
-- the README's "Trust model & limits" section. Isolation is still per
-- project: a trip on someone's own Supabase project is only listable by
-- whoever that organiser has given the project's URL/key to.
create or replace function public.gts_list_trips()
returns table (id uuid, write_key text, read_key text, state jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select t.id, t.write_key, t.read_key, s.state, coalesce(s.updated_at, t.created_at)
  from gts_trips t
  left join gts_trip_state s on s.trip_id = t.id;
$$;

-- Called by the organiser app's Delete action. Without this, a "deleted"
-- trip would just silently reappear next time gts_list_trips runs, since
-- deleting only from local storage never touched the database row.
create or replace function public.gts_delete_trip(
  p_trip uuid, p_key text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from gts_trips t where t.id = p_trip and t.read_key = p_key) then
    raise exception 'bad trip or key';
  end if;
  delete from gts_trips where id = p_trip; -- cascades to cards/completed/trip_state
end $$;

revoke all on public.gts_trips, public.gts_cards, public.gts_completed, public.gts_trip_state from anon, authenticated;
grant execute on function
  public.gts_register_trip(uuid, text, text),
  public.gts_submit_card(uuid, text, int, int, text, jsonb, boolean),
  public.gts_organiser_submit_card(uuid, text, int, int, text, jsonb, boolean),
  public.gts_fetch_own_card(uuid, text, int, int),
  public.gts_fetch_cards(uuid, text, int),
  public.gts_complete_round(uuid, text, int, boolean),
  public.gts_save_trip_state(uuid, text, jsonb),
  public.gts_load_trip_state(uuid, text),
  public.gts_list_trips(),
  public.gts_delete_trip(uuid, text)
to anon;
