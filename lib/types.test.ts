import { describe, it, expect } from "vitest";
import {
  VIBE_VALUES,
  VIBE_EMOJI,
  SESSION_STATUS_VALUES,
  SONG_QUALITY_VALUES,
  SONG_QUALITY_LABEL,
  VOLUME_CAL_VALUES,
  VOLUME_CAL_LABEL,
  CONFIGURATION_VALUES,
  CONFIGURATION_LABEL,
  OVERALL_FEEL_VALUES,
  OVERALL_FEEL_LABEL,
  type Vibe,
  type SessionStatus,
  type SongQuality,
  type VolumeCal,
  type Configuration,
  type OverallFeel,
} from "./supabase/types";

describe("Vibe constants", () => {
  it("VIBE_VALUES contains exactly fire, more_energy, softer", () => {
    expect(VIBE_VALUES).toEqual(["fire", "more_energy", "softer"]);
  });

  it("VIBE_VALUES has 3 entries", () => {
    expect(VIBE_VALUES.length).toBe(3);
  });

  it("VIBE_EMOJI has entry for every vibe value", () => {
    for (const vibe of VIBE_VALUES) {
      expect(VIBE_EMOJI[vibe]).toBeDefined();
      expect(typeof VIBE_EMOJI[vibe]).toBe("string");
    }
  });

  it("VIBE_EMOJI values are non-empty", () => {
    for (const vibe of VIBE_VALUES) {
      expect(VIBE_EMOJI[vibe].length).toBeGreaterThan(0);
    }
  });
});

describe("SessionStatus constants", () => {
  it("contains expected values in order", () => {
    expect(SESSION_STATUS_VALUES).toEqual(["pre_set", "live", "post_set", "complete"]);
  });

  it("has 4 entries", () => {
    expect(SESSION_STATUS_VALUES.length).toBe(4);
  });
});

describe("SongQuality constants", () => {
  it("contains expected values", () => {
    expect(SONG_QUALITY_VALUES).toEqual(["off", "fine", "locked_in"]);
  });

  it("labels match values", () => {
    for (const q of SONG_QUALITY_VALUES) {
      expect(SONG_QUALITY_LABEL[q]).toBeDefined();
    }
  });
});

describe("VolumeCal constants", () => {
  it("contains expected values", () => {
    expect(VOLUME_CAL_VALUES).toEqual(["too_loud", "right", "too_soft"]);
  });

  it("labels match values", () => {
    for (const v of VOLUME_CAL_VALUES) {
      expect(VOLUME_CAL_LABEL[v]).toBeDefined();
    }
  });
});

describe("Configuration constants", () => {
  it("contains expected values", () => {
    expect(CONFIGURATION_VALUES).toEqual(["solo", "duo", "trio", "ensemble"]);
  });

  it("labels match values", () => {
    for (const c of CONFIGURATION_VALUES) {
      expect(CONFIGURATION_LABEL[c]).toBeDefined();
    }
  });
});

describe("OverallFeel constants", () => {
  it("contains expected values", () => {
    expect(OVERALL_FEEL_VALUES).toEqual(["off_night", "fine", "felt_it"]);
  });

  it("labels match values", () => {
    for (const f of OVERALL_FEEL_VALUES) {
      expect(OVERALL_FEEL_LABEL[f]).toBeDefined();
    }
  });
});

describe("Type system consistency", () => {
  it("all enum arrays are non-empty", () => {
    const arrays = [
      VIBE_VALUES,
      SESSION_STATUS_VALUES,
      SONG_QUALITY_VALUES,
      VOLUME_CAL_VALUES,
      CONFIGURATION_VALUES,
      OVERALL_FEEL_VALUES,
    ];
    for (const arr of arrays) {
      expect(arr.length).toBeGreaterThan(0);
    }
  });

  it("label maps cover every value (no missing labels)", () => {
    const maps: [readonly string[], Record<string, string>][] = [
      [SONG_QUALITY_VALUES, SONG_QUALITY_LABEL],
      [VOLUME_CAL_VALUES, VOLUME_CAL_LABEL],
      [CONFIGURATION_VALUES, CONFIGURATION_LABEL],
      [OVERALL_FEEL_VALUES, OVERALL_FEEL_LABEL],
    ];
    for (const [values, labels] of maps) {
      expect(Object.keys(labels).sort()).toEqual([...values].sort());
    }
  });
});
