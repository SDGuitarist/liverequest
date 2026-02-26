-- LiveRequest Seed Data
-- Run this in the Supabase SQL Editor after running schema.sql.
-- Creates a test gig and 25 songs for development.

-- Test gig (active, requests open)
insert into gigs (venue_name, gig_date, is_active, requests_open)
values ('The Blue Note', '2026-03-06', true, true);

-- Test songs (mix of genres a live performer might cover)
insert into songs (title, artist, sort_order) values
  ('Bohemian Rhapsody', 'Queen', 1),
  ('Hotel California', 'Eagles', 2),
  ('Wonderwall', 'Oasis', 3),
  ('Sweet Child O'' Mine', 'Guns N'' Roses', 4),
  ('Let It Be', 'The Beatles', 5),
  ('Hallelujah', 'Leonard Cohen', 6),
  ('Imagine', 'John Lennon', 7),
  ('Hey Jude', 'The Beatles', 8),
  ('Wish You Were Here', 'Pink Floyd', 9),
  ('Stairway to Heaven', 'Led Zeppelin', 10),
  ('Yesterday', 'The Beatles', 11),
  ('Blackbird', 'The Beatles', 12),
  ('Creep', 'Radiohead', 13),
  ('Fly Me to the Moon', 'Frank Sinatra', 14),
  ('The Way You Look Tonight', 'Frank Sinatra', 15),
  ('Stand by Me', 'Ben E. King', 16),
  ('Riptide', 'Vance Joy', 17),
  ('Perfect', 'Ed Sheeran', 18),
  ('Thinking Out Loud', 'Ed Sheeran', 19),
  ('All of Me', 'John Legend', 20),
  ('Can''t Help Falling in Love', 'Elvis Presley', 21),
  ('Somewhere Over the Rainbow', 'Israel Kamakawiwo''ole', 22),
  ('What a Wonderful World', 'Louis Armstrong', 23),
  ('La Bamba', 'Ritchie Valens', 24),
  ('Despacito', 'Luis Fonsi', 25);
