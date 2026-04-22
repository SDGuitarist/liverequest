import { Database } from "./database.types";

// ============================================
// ROW TYPE ALIASES
// ============================================

export type Song = Database["public"]["Tables"]["songs"]["Row"];
export type Gig = Database["public"]["Tables"]["gigs"]["Row"];
export type Venue = Database["public"]["Tables"]["venues"]["Row"];


// Narrowed SongRequest type — overrides vibe from string to Vibe union
export type SongRequest = Omit<
  Database["public"]["Tables"]["song_requests"]["Row"],
  "vibe"
> & { vibe: Vibe | null };

// Narrowed PerformanceSession — overrides status from string to SessionStatus union
export type PerformanceSession = Omit<
  Database["public"]["Tables"]["performance_sessions"]["Row"],
  "status" | "configuration"
> & { status: SessionStatus; configuration: Configuration };

// ============================================
// ENUM-LIKE CONST ARRAYS + UNION TYPES
// All enforced by DB CHECK constraints — keep in sync
// ============================================

// Vibes (guest feedback)
export const VIBE_VALUES = ["fire", "more_energy", "softer"] as const;
export type Vibe = (typeof VIBE_VALUES)[number];

export function isVibe(v: string): v is Vibe {
  return (VIBE_VALUES as readonly string[]).includes(v);
}

export const VIBE_EMOJI: Record<Vibe, string> = {
  fire: "\uD83D\uDD25",
  more_energy: "\u26A1",
  softer: "\uD83C\uDF19",
};

// Session status (dashboard state machine)
export const SESSION_STATUS_VALUES = ["pre_set", "live", "post_set", "complete"] as const;
export type SessionStatus = (typeof SESSION_STATUS_VALUES)[number];

// Song quality (between-song logging)
export const SONG_QUALITY_VALUES = ["off", "fine", "locked_in"] as const;
export type SongQuality = (typeof SONG_QUALITY_VALUES)[number];

export const SONG_QUALITY_LABEL: Record<SongQuality, string> = {
  off: "Off",
  fine: "Fine",
  locked_in: "Locked In",
};

// Volume calibration (between-song logging)
export const VOLUME_CAL_VALUES = ["too_loud", "right", "too_soft"] as const;
export type VolumeCal = (typeof VOLUME_CAL_VALUES)[number];

export const VOLUME_CAL_LABEL: Record<VolumeCal, string> = {
  too_loud: "Too Loud",
  right: "Right",
  too_soft: "Too Soft",
};

// Narrowed SongLog — overrides song_quality and volume_calibration from string to unions
export type SongLog = Omit<
  Database["public"]["Tables"]["song_logs"]["Row"],
  "song_quality" | "volume_calibration"
> & { song_quality: SongQuality; volume_calibration: VolumeCal };

// Performer configuration
export const CONFIGURATION_VALUES = ["solo", "duo", "trio", "ensemble"] as const;
export type Configuration = (typeof CONFIGURATION_VALUES)[number];

export const CONFIGURATION_LABEL: Record<Configuration, string> = {
  solo: "Solo",
  duo: "Duo",
  trio: "Trio",
  ensemble: "Full Ensemble",
};

// Overall set feel (post-set debrief)
export const OVERALL_FEEL_VALUES = ["off_night", "fine", "felt_it"] as const;
export type OverallFeel = (typeof OVERALL_FEEL_VALUES)[number];

export const OVERALL_FEEL_LABEL: Record<OverallFeel, string> = {
  off_night: "Off Night",
  fine: "Fine",
  felt_it: "Felt It",
};

// ============================================
// POST-SET DATA INTERFACE
// ============================================

export interface PostSetData {
  version: 1;
  setlist_deviations: string | null;
  walkup_count: number;
  tips_received: boolean;
  staff_feedback: string | null;
  overall_feel: OverallFeel;
  complaints_received: boolean;
  observations: string | null;
}
