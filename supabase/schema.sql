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

-- Public insert: song requests (hardened — validates gig active + open + enforces limit)
create policy "Insert requests on open gigs with limit" on song_requests
  for insert to anon
  with check (
    -- Gig must exist, be active, and have requests open
    exists (
      select 1 from gigs
      where gigs.id = gig_id
        and gigs.is_active = true
        and gigs.requests_open = true
    )
    -- Song must exist and be active
    and exists (
      select 1 from songs
      where songs.id = song_id
        and songs.is_active = true
    )
    -- Enforce 5-request limit per session per gig
    and (
      select count(*) from song_requests sr
      where sr.gig_id = song_requests.gig_id
        and sr.session_id = song_requests.session_id
    ) < 5
  );

-- ============================================
-- REALTIME
-- ============================================

alter publication supabase_realtime add table song_requests;
alter publication supabase_realtime add table gigs;
