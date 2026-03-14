-- Cycle 2: Musician Intelligence
-- Adds venues, performance_sessions, song_logs tables
-- Adds energy_level and repertoire_type columns to songs

-- ============================================
-- NEW TABLES
-- ============================================

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
-- ALTER EXISTING TABLES
-- ============================================

-- Add song-level tags to songs (synced from GigPrep, editable in LiveRequest)
alter table songs add column energy_level text
  check (energy_level in ('ambient', 'medium', 'high'));
alter table songs add column repertoire_type text
  check (repertoire_type in ('instrumental', 'instrumental_with_vocals',
    'vocal_forward', 'traditional_cultural', 'contemporary_covers'));

-- ============================================
-- CONSTRAINTS
-- ============================================

-- Only one live session per gig at a time
create unique index idx_one_live_session_per_gig
  on performance_sessions (gig_id) where status = 'live';

-- ============================================
-- INDEXES
-- ============================================

-- Find sessions for a gig (dashboard state machine)
create index idx_sessions_gig on performance_sessions(gig_id, created_at desc);

-- Find song logs for a session (between-song history)
create index idx_song_logs_session on song_logs(session_id, set_position);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- All new tables: RLS enabled, zero anon policies.
-- All access via createServiceClient() in auth-gated API routes.
alter table venues enable row level security;
alter table performance_sessions enable row level security;
alter table song_logs enable row level security;

-- No anon SELECT/INSERT/UPDATE/DELETE policies.
-- Performer mutations go through service role key in API routes,
-- gated by isAuthenticated() cookie check (defense-in-depth).
