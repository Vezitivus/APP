-- MELNĀ KASTE
-- Authoritative state is games.snapshot. The other tables are projections so the
-- data can be inspected in the Supabase table editor. Apply this file once in
-- the Supabase SQL editor (or with the Supabase CLI). It does not enable any
-- paid extension.

create extension if not exists pgcrypto;

create table if not exists app_state (
  id integer primary key check (id = 1),
  current_game_id uuid
);

create table if not exists games (
  id uuid primary key,
  code text not null unique,
  version integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists players (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  public_name text not null,
  session_hash text not null,
  recovery_hash text not null,
  call_count integer not null default 0,
  eligible boolean not null default true,
  removed boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  status text not null,
  player_id uuid,
  card_id text not null,
  category text not null,
  qr_token text,
  qr_expires_at timestamptz,
  private_payload jsonb not null default '{}'::jsonb,
  public_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists missions (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null,
  event_id uuid,
  card_id text not null,
  qr_token text,
  title text not null,
  body text not null,
  status text not null,
  deadline_at timestamptz,
  completed_at timestamptz
);

create table if not exists perks (
  id uuid primary key,
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null,
  event_id uuid,
  card_id text not null,
  qr_token text,
  name text not null,
  description text not null,
  status text not null,
  used_at timestamptz
);

create table if not exists videos (
  id text primary key,
  public_id text not null unique,
  folder text not null,
  filename text not null,
  url text not null,
  bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  updated_at timestamptz not null default now()
);

create table if not exists cards (
  id text primary key,
  definition jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists history (
  id text primary key,
  game_id uuid not null references games(id) on delete cascade,
  at timestamptz not null,
  type text not null,
  summary text not null
);

create table if not exists rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  hits integer not null
);

create table if not exists tv_pair_tokens (
  token_hash text primary key,
  game_id uuid not null references games(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists tv_feed (
  game_id uuid primary key references games(id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists players_game_idx on players (game_id);
create index if not exists events_game_idx on events (game_id);
create index if not exists events_qr_idx on events (qr_token);
create index if not exists missions_game_idx on missions (game_id);
create index if not exists missions_qr_idx on missions (qr_token);
create index if not exists perks_game_idx on perks (game_id);
create index if not exists history_game_idx on history (game_id, at desc);

insert into app_state (id, current_game_id) values (1, null)
on conflict (id) do nothing;

alter table app_state enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table events enable row level security;
alter table missions enable row level security;
alter table perks enable row level security;
alter table videos enable row level security;
alter table cards enable row level security;
alter table history enable row level security;
alter table rate_limits enable row level security;
alter table tv_pair_tokens enable row level security;
alter table tv_feed enable row level security;

-- Supabase creates the anon and authenticated roles. A plain Postgres
-- database used for a local check does not, so the grants are skipped there.
do $$
declare
  tbl text;
begin
  if exists (select 1 from pg_roles where rolname = 'anon')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    foreach tbl in array array[
      'app_state', 'games', 'players', 'events', 'missions', 'perks',
      'videos', 'cards', 'history', 'rate_limits', 'tv_pair_tokens', 'tv_feed'
    ]
    loop
      execute format('revoke all on table %I from anon, authenticated', tbl);
    end loop;
    execute 'grant select on table tv_feed to anon, authenticated';
    execute 'drop policy if exists tv_feed_public_read on tv_feed';
    execute 'create policy tv_feed_public_read on tv_feed for select to anon, authenticated using (true)';
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table tv_feed;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
