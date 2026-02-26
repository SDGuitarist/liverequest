import { Database } from "./database.types";

// Convenience type aliases for database rows
export type Song = Database["public"]["Tables"]["songs"]["Row"];
export type Gig = Database["public"]["Tables"]["gigs"]["Row"];
export type SongRequest = Database["public"]["Tables"]["song_requests"]["Row"];

// Insert types (for creating new records)
export type SongInsert = Database["public"]["Tables"]["songs"]["Insert"];
export type GigInsert = Database["public"]["Tables"]["gigs"]["Insert"];
export type SongRequestInsert =
  Database["public"]["Tables"]["song_requests"]["Insert"];
