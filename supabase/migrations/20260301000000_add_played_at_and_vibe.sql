-- Add played_at and vibe columns to song_requests
-- played_at: soft-delete for "Mark as Played" (NULL = pending, timestamp = played)
-- vibe: optional audience feedback emoji after requesting a song

-- 1. Add columns (safe: no table rewrite, nullable DEFAULT NULL)
ALTER TABLE song_requests
  ADD COLUMN played_at timestamptz DEFAULT NULL;

-- SYNC: vibe values also defined in lib/supabase/types.ts (VIBE_VALUES) and RLS policy below
ALTER TABLE song_requests
  ADD COLUMN vibe text DEFAULT NULL
  CONSTRAINT valid_vibe CHECK (vibe IN ('fire', 'more_energy', 'softer'));
-- vibe NULL means either "not prompted" or "prompted but skipped" — acceptable for v1

-- 2. Column-level privilege: anon can ONLY update vibe, nothing else
-- WARNING: REVOKE removes ALL table-level UPDATE privileges for anon.
-- Any future columns that anon needs to UPDATE will require explicit GRANT statements.
-- Order matters: REVOKE removes table-level, GRANT adds column-level.
REVOKE UPDATE ON song_requests FROM anon;
GRANT UPDATE (vibe) ON song_requests TO anon;

-- 3. RLS: which rows anon can update (vibe not already set)
-- No active-gig check: the INSERT is the access control gate;
-- the vibe is just metadata on an already-valid request.
-- Allowing vibes after gig closes prevents silent failure on the overlay.
CREATE POLICY "Anon can set vibe on requests"
  ON song_requests
  FOR UPDATE
  TO anon
  USING (
    vibe IS NULL
  )
  WITH CHECK (
    vibe IN ('fire', 'more_energy', 'softer')
  );

-- ============================================
-- ROLLBACK SQL (run manually if needed)
-- ============================================
-- DROP POLICY IF EXISTS "Anon can set vibe on requests" ON song_requests;
-- REVOKE UPDATE (vibe) ON song_requests FROM anon;
-- ALTER TABLE song_requests DROP CONSTRAINT IF EXISTS valid_vibe;
-- ALTER TABLE song_requests DROP COLUMN IF EXISTS vibe;
-- ALTER TABLE song_requests DROP COLUMN IF EXISTS played_at;
