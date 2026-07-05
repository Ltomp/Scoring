-- Golf Trip Scoring — drop-box schema.
-- Paste this once into your Supabase project's SQL Editor and run it.
--
-- Privacy model: the tables are completely inaccessible to the public anon
-- key (RLS enabled, no policies). ALL access goes through the SECURITY
-- DEFINER functions below, which check the trip's write/read keys:
--   * players hold only the write key -> can submit their own card, can
--     never read anything back
--   * organisers hold the read key -> can read cards and manage rounds

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

alter table public.gts_trips enable row level security;
alter table public.gts_cards enable row level security;
alter table public.gts_completed enable row level security;
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

revoke all on public.gts_trips, public.gts_cards, public.gts_completed from anon, authenticated;
grant execute on function
  public.gts_register_trip(uuid, text, text),
  public.gts_submit_card(uuid, text, int, int, text, jsonb, boolean),
  public.gts_fetch_cards(uuid, text, int),
  public.gts_complete_round(uuid, text, int, boolean)
to anon;
