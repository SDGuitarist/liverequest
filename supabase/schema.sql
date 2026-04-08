-- LiveRequest Database Schema
-- Run this in the Supabase SQL Editor after creating your project.

-- ============================================
-- TABLES
-- ============================================

-- Songs (the performer's repertoire)
-- No performers table — one performer, hardcode the slug
create table songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  sort_order int default 0,
  is_active boolean default true,
  energy_level text check (energy_level in ('ambient', 'medium', 'high')),
  repertoire_type text check (repertoire_type in ('instrumental', 'instrumental_with_vocals',
    'vocal_forward', 'traditional_cultural', 'contemporary_covers')),
  created_at timestamptz not null default now()
);

-- Gigs
create table gigs (
  id uuid primary key default gen_random_uuid(),
  venue_name text not null,
  gig_date date not null,
  is_active boolean default false,
  requests_open boolean default false,
  created_at timestamptz not null default now()
);

-- Song Requests
create table song_requests (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references gigs(id) on delete restrict,
  song_id uuid not null references songs(id) on delete restrict,
  session_id text not null,
  created_at timestamptz not null default now(),
  played_at timestamptz default null,
  -- SYNC: vibe values also defined in lib/supabase/types.ts (VIBE_VALUES) and RLS policy below
  vibe text default null constraint valid_vibe check (vibe in ('fire', 'more_energy', 'softer')),
  unique(gig_id, song_id, session_id)
);

-- Venues (saved presets for repeat locations)
create table venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  notes text,
  default_configuration text check (default_configuration in ('solo', 'duo', 'trio', 'ensemble')),
  default_genre_style text,
  created_at timestamptz not null default now()
);

-- Performance Sessions (one per set, linked to a gig)
create table performance_sessions (
  id uuid primary key default gen_random_uuid(),
  gig_id uuid not null references gigs(id) on delete restrict,
  venue_id uuid references venues(id) on delete set null,
  set_number int not null default 1,
  configuration text not null check (configuration in ('solo', 'duo', 'trio', 'ensemble')),
  genre_style text,
  status text not null default 'pre_set' check (status in ('pre_set', 'live', 'post_set', 'complete')),
  post_set_data jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Song Logs (between-song observations, one per song played)
create table song_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references performance_sessions(id) on delete cascade,
  song_id uuid references songs(id) on delete set null,
  song_title text,
  song_quality text not null check (song_quality in ('off', 'fine', 'locked_in')),
  volume_calibration text not null check (volume_calibration in ('too_loud', 'right', 'too_soft')),
  guest_acknowledgment boolean not null default false,
  set_position int not null,
  logged_at timestamptz not null default now()
);

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Only one gig can be active at a time (prevents data corruption)
create unique index idx_one_active_gig
  on gigs(is_active)
  where is_active = true;

-- Only one live session per gig at a time
create unique index idx_one_live_session_per_gig
  on performance_sessions (gig_id) where status = 'live';

-- ============================================
-- INDEXES
-- ============================================

-- Loading songs (sorted, filtered by active)
create index idx_songs_active on songs(is_active, sort_order)
  where is_active = true;

-- Finding the active gig
create index idx_gigs_active on gigs(is_active)
  where is_active = true;

-- Counting requests per session per gig (for limit check)
create index idx_requests_gig_session on song_requests(gig_id, session_id);

-- Loading requests for a gig, ordered by time
create index idx_requests_gig_created on song_requests(gig_id, created_at desc);

-- Find sessions for a gig (dashboard state machine)
create index idx_sessions_gig on performance_sessions(gig_id, created_at desc);

-- Find song logs for a session (between-song history) — UNIQUE prevents duplicate positions
create unique index idx_song_logs_session_position on song_logs(session_id, set_position);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table songs enable row level security;
alter table gigs enable row level security;
alter table song_requests enable row level security;
alter table venues enable row level security;
alter table performance_sessions enable row level security;
alter table song_logs enable row level security;

-- Public read: songs (active only)
create policy "Public read active songs" on songs
  for select to anon using (is_active = true);

-- Public read: gigs (active only)
create policy "Public read active gigs" on gigs
  for select to anon using (is_active = true);

-- Public read: song requests (only for active gig)
create policy "Public read requests for active gigs" on song_requests
  for select to anon
  using (gig_id in (select id from gigs where is_active = true));

-- Helper function: count requests per session (SECURITY DEFINER bypasses RLS to avoid recursion)
create or replace function count_session_requests(p_gig_id uuid, p_session_id text)
returns bigint
language sql
security definer
as $$
  select count(*) from song_requests
  where gig_id = p_gig_id and session_id = p_session_id;
$$;

-- Public insert: song requests (hardened — validates gig active + open + enforces limit)
create policy "insert_requests_validated" on song_requests
  for insert to anon
  with check (
    exists (
      select 1 from gigs
      where gigs.id = gig_id
        and gigs.is_active = true
        and gigs.requests_open = true
    )
    and exists (
      select 1 from songs
      where songs.id = song_id
        and songs.is_active = true
    )
    and count_session_requests(gig_id, session_id) < 5
  );

-- Column-level privilege: anon can ONLY update vibe, nothing else.
-- WARNING: REVOKE removes ALL table-level UPDATE privileges for anon.
-- Any future columns that anon needs to UPDATE will require explicit GRANT statements.
revoke update on song_requests from anon;
grant update (vibe) on song_requests to anon;

-- Anon can set vibe once per request (vibe IS NULL prevents re-setting)
create policy "Anon can set vibe on requests" on song_requests
  for update to anon
  using (vibe is null)
  with check (vibe in ('fire', 'more_energy', 'softer'));

-- Performer dismiss & toggle: handled via service role key in API routes.
-- No anon DELETE or UPDATE policies needed for played_at — the API route
-- cookie check is the sole auth gate, and the service role key bypasses RLS.

-- ============================================
-- FUNCTIONS
-- ============================================

-- Atomic song log insert — verifies session is live, computes next set_position,
-- and inserts in a single statement. Returns NULL if session is not live.
create or replace function insert_song_log(
  p_session_id uuid,
  p_song_id uuid,
  p_song_title text,
  p_song_quality text,
  p_volume_calibration text,
  p_guest_acknowledgment boolean
) returns song_logs as $$
  insert into song_logs (
    session_id, song_id, song_title,
    song_quality, volume_calibration, guest_acknowledgment,
    set_position
  )
  select
    p_session_id, p_song_id, p_song_title,
    p_song_quality, p_volume_calibration, p_guest_acknowledgment,
    coalesce(max(sl.set_position), 0) + 1
  from performance_sessions ps
  left join song_logs sl on sl.session_id = ps.id
  where ps.id = p_session_id
    and ps.status = 'live'
  group by ps.id
  returning *;
$$ language sql;

-- ============================================
-- REALTIME
-- ============================================

alter publication supabase_realtime add table song_requests;
alter publication supabase_realtime add table gigs;
