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

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Only one gig can be active at a time (prevents data corruption)
create unique index idx_one_active_gig
  on gigs(is_active)
  where is_active = true;

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

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table songs enable row level security;
alter table gigs enable row level security;
alter table song_requests enable row level security;

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
-- REALTIME
-- ============================================

alter publication supabase_realtime add table song_requests;
alter publication supabase_realtime add table gigs;
