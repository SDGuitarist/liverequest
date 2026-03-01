import { Database } from "./database.types";

// Convenience type aliases for database rows
export type Song = Database["public"]["Tables"]["songs"]["Row"];
export type Gig = Database["public"]["Tables"]["gigs"]["Row"];

// Single source of truth for vibe values — also enforced by DB CHECK constraint
// SYNC: if you add a 4th vibe, also update the CHECK constraint and RLS WITH CHECK
export const VIBE_VALUES = ["fire", "more_energy", "softer"] as const;
export type Vibe = (typeof VIBE_VALUES)[number];

// Emoji map for vibe display — shared between audience overlay and performer dashboard
export const VIBE_EMOJI: Record<Vibe, string> = {
  fire: "\uD83D\uDD25",
  more_energy: "\u26A1",
  softer: "\uD83C\uDF19",
};

// Narrowed SongRequest type — overrides vibe from string to Vibe union
export type SongRequest = Omit<
  Database["public"]["Tables"]["song_requests"]["Row"],
  "vibe"
> & { vibe: Vibe | null };
