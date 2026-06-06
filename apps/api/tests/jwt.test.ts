import { describe, it, expect, beforeAll } from "vitest";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  hashToken,
} from "../src/utils/jwt";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-32-characters-long-xx";
});

describe("access tokens", () => {
  it("round-trips the payload claims", () => {
    const token = generateAccessToken({
      userId: "u1",
      tenantId: "t1",
      role: "OWNER",
      email: "owner@example.com",
    });
    const decoded = verifyAccessToken(token);
    expect(decoded).toMatchObject({
      userId: "u1",
      tenantId: "t1",
      role: "OWNER",
      email: "owner@example.com",
    });
  });

  it("returns null for a tampered token", () => {
    expect(verifyAccessToken("not.a.valid.jwt")).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("generates 64-char hex opaque tokens", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("hashToken", () => {
  it("is deterministic and collision-distinct", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(hashToken("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});
