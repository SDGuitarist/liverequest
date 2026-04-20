import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { requireEnv } from "./env";

describe("requireEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns value when env var exists", () => {
    process.env.TEST_VAR = "hello";
    expect(requireEnv("TEST_VAR")).toBe("hello");
  });

  it("throws when env var is missing", () => {
    delete process.env.TEST_VAR;
    expect(() => requireEnv("TEST_VAR")).toThrow("Missing required environment variable: TEST_VAR");
  });

  it("throws when env var is empty string", () => {
    process.env.TEST_VAR = "";
    expect(() => requireEnv("TEST_VAR")).toThrow("Missing required environment variable: TEST_VAR");
  });

  it("returns non-empty string values", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    expect(requireEnv("DATABASE_URL")).toBe("postgres://localhost:5432/db");
  });
});
