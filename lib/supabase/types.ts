import { Database } from "./database.types";

// Convenience type aliases for database rows
export type Song = Database["public"]["Tables"]["songs"]["Row"];
export type Gig = Database["public"]["Tables"]["gigs"]["Row"];
