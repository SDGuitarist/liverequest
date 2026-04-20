import { describe, it, expect } from "vitest";
import { isUUID } from "./validation";

describe("isUUID", () => {
  it("accepts valid UUID v4", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts uppercase UUID", () => {
    expect(isUUID("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("accepts mixed case UUID", () => {
    expect(isUUID("550e8400-E29B-41d4-a716-446655440000")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isUUID("")).toBe(false);
  });

  it("rejects random string", () => {
    expect(isUUID("not-a-uuid")).toBe(false);
  });

  it("rejects UUID without dashes", () => {
    expect(isUUID("550e8400e29b41d4a716446655440000")).toBe(false);
  });

  it("rejects UUID with extra characters", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-446655440000-extra")).toBe(false);
  });

  it("rejects UUID with wrong segment lengths", () => {
    expect(isUUID("550e840-e29b-41d4-a716-446655440000")).toBe(false);
  });

  it("rejects UUID with non-hex characters", () => {
    expect(isUUID("550e8400-e29b-41d4-a716-44665544zzzz")).toBe(false);
  });
});
