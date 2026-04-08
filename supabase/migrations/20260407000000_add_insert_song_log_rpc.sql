-- Migration: Atomic song log insertion with auto-incrementing set_position.
--
-- PREFLIGHT: Before applying, check for existing duplicate (session_id, set_position) rows:
--   SELECT session_id, set_position, count(*)
--   FROM song_logs
--   GROUP BY session_id, set_position
--   HAVING count(*) > 1;
--
-- REMEDIATION: If duplicates exist, re-number them before adding the UNIQUE constraint:
--   WITH numbered AS (
--     SELECT id, row_number() OVER (PARTITION BY session_id ORDER BY logged_at) AS new_pos
--     FROM song_logs
--   )
--   UPDATE song_logs SET set_position = numbered.new_pos
--   FROM numbered WHERE song_logs.id = numbered.id;

-- Step 1: Drop the existing non-unique index (replaced by unique index below)
drop index if exists idx_song_logs_session;

-- Step 2: Create UNIQUE index on (session_id, set_position)
-- Prevents duplicate positions from concurrent inserts. If two calls race,
-- one wins and the other gets error 23505 — the API route retries once.
create unique index idx_song_logs_session_position
  on song_logs(session_id, set_position);

-- Step 3: Atomic insert function — verifies session is live, computes next
-- position, and inserts in a single statement.
-- SECURITY INVOKER (default) — service role already bypasses RLS.
-- Returns NULL (zero rows) if session is not live or not found.
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
