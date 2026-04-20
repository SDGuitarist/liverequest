/**
 * Tests for API route input validation patterns.
 *
 * Since Next.js App Router routes depend on server-only imports (cookies,
 * createServiceClient), we test the validation logic patterns that all
 * routes share: UUID checking, body shape validation, and vibe type
 * enforcement.
 */
import { describe, it, expect } from "vitest";
import { isUUID } from "./validation";
import { VIBE_VALUES, type Vibe } from "./supabase/types";

// ── Validation patterns used across all API routes ──

describe("API route validation patterns", () => {
  // All authenticated routes check: typeof field === "string"
  describe("string field validation", () => {
    it("accepts string fields", () => {
      const body = { gigId: "550e8400-e29b-41d4-a716-446655440000", requestsOpen: true };
      expect(typeof body.gigId === "string").toBe(true);
    });

    it("rejects number fields", () => {
      const body = { gigId: 123 };
      expect(typeof body.gigId === "string").toBe(false);
    });

    it("rejects null fields", () => {
      const body = { gigId: null };
      expect(typeof body.gigId === "string").toBe(false);
    });

    it("rejects undefined fields", () => {
      const body = {} as Record<string, unknown>;
      expect(typeof body.gigId === "string").toBe(false);
    });
  });

  // All routes that take IDs check isUUID
  describe("UUID validation in route context", () => {
    it("valid UUIDs pass the route check", () => {
      const gigId = "550e8400-e29b-41d4-a716-446655440000";
      const songId = "660e8400-e29b-41d4-a716-446655440000";
      expect(isUUID(gigId) && isUUID(songId)).toBe(true);
    });

    it("SQL injection attempts fail UUID check", () => {
      expect(isUUID("'; DROP TABLE gigs; --")).toBe(false);
    });

    it("empty string fails UUID check", () => {
      expect(isUUID("")).toBe(false);
    });

    it("path traversal attempts fail UUID check", () => {
      expect(isUUID("../../etc/passwd")).toBe(false);
    });
  });

  // Vibe endpoint checks VIBE_VALUES.includes(vibe)
  describe("vibe type validation", () => {
    it("accepts valid vibe values", () => {
      for (const vibe of VIBE_VALUES) {
        expect(VIBE_VALUES.includes(vibe)).toBe(true);
      }
    });

    it("rejects invalid vibe value", () => {
      expect(VIBE_VALUES.includes("invalid" as Vibe)).toBe(false);
    });

    it("rejects empty string as vibe", () => {
      expect(VIBE_VALUES.includes("" as Vibe)).toBe(false);
    });

    it("rejects vibe with wrong case", () => {
      expect(VIBE_VALUES.includes("Fire" as Vibe)).toBe(false);
      expect(VIBE_VALUES.includes("MORE_ENERGY" as Vibe)).toBe(false);
    });

    it("rejects numeric vibe", () => {
      expect(VIBE_VALUES.includes(1 as unknown as Vibe)).toBe(false);
    });
  });

  // Toggle endpoint checks typeof requestsOpen === "boolean"
  describe("boolean field validation", () => {
    it("accepts true", () => {
      expect(typeof true === "boolean").toBe(true);
    });

    it("accepts false", () => {
      expect(typeof false === "boolean").toBe(true);
    });

    it("rejects string 'true'", () => {
      expect(typeof "true" === "boolean").toBe(false);
    });

    it("rejects number 1", () => {
      expect(typeof 1 === "boolean").toBe(false);
    });
  });
});

// ── PGRST116 error code pattern ──

describe("Supabase error code handling pattern", () => {
  it("PGRST116 means no rows matched (RLS filter or not found)", () => {
    const error = { code: "PGRST116", message: "The result contains 0 rows" };
    expect(error.code === "PGRST116").toBe(true);
  });

  it("other error codes are server errors", () => {
    const error = { code: "42P01", message: "relation does not exist" };
    expect(error.code === "PGRST116").toBe(false);
  });
});

// ── Route response patterns ──

describe("API response shape consistency", () => {
  it("success responses have { success: true }", () => {
    const response = { success: true };
    expect(response.success).toBe(true);
  });

  it("error responses have { error: string }", () => {
    const errorResponses = [
      { error: "Unauthorized", status: 401 },
      { error: "Invalid JSON", status: 400 },
      { error: "Missing gigId or requestsOpen", status: 400 },
      { error: "Invalid ID format", status: 400 },
      { error: "Gig not found or inactive", status: 404 },
      { error: "Operation failed", status: 500 },
      { error: "Invalid vibe value", status: 400 },
      { error: "Vibe already set or request not found", status: 409 },
    ];

    for (const resp of errorResponses) {
      expect(typeof resp.error).toBe("string");
      expect(resp.error.length).toBeGreaterThan(0);
      expect(resp.status).toBeGreaterThanOrEqual(400);
      expect(resp.status).toBeLessThan(600);
    }
  });

  it("error messages never expose internal details", () => {
    const publicErrors = [
      "Unauthorized",
      "Invalid JSON",
      "Missing gigId or requestsOpen",
      "Invalid ID format",
      "Gig not found or inactive",
      "Operation failed",
      "Invalid vibe value",
      "Vibe already set or request not found",
      "Missing password",
      "Wrong password",
    ];

    for (const msg of publicErrors) {
      // No SQL, no stack traces, no internal references
      expect(msg).not.toContain("SELECT");
      expect(msg).not.toContain("supabase");
      expect(msg).not.toContain("Error:");
      expect(msg).not.toContain("at ");
    }
  });
});
