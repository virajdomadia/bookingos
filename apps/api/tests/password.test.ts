import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, validatePassword } from "../src/utils/password";

describe("validatePassword", () => {
  it("accepts a strong password", () => {
    expect(validatePassword("Xk9!mfQ2").valid).toBe(true);
  });

  it("rejects passwords shorter than 8 chars", () => {
    expect(validatePassword("Xk9!m").valid).toBe(false);
  });

  it("requires an uppercase letter", () => {
    expect(validatePassword("xk9!mfq2").valid).toBe(false);
  });

  it("requires a lowercase letter", () => {
    expect(validatePassword("XK9!MFQ2").valid).toBe(false);
  });

  it("requires a number", () => {
    expect(validatePassword("Xk!mfQpz").valid).toBe(false);
  });

  it("requires a special character", () => {
    expect(validatePassword("Xk9mfQ2p").valid).toBe(false);
  });

  it("rejects 3+ repeated characters", () => {
    expect(validatePassword("Xaaa9!Qp").valid).toBe(false);
  });

  it("rejects common patterns", () => {
    expect(validatePassword("password1!A").valid).toBe(false);
  });

  it("rejects sequential characters", () => {
    expect(validatePassword("Xk123!Qp").valid).toBe(false);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips a password", async () => {
    const hash = await hashPassword("Xk9!mfQ2");
    expect(hash).not.toBe("Xk9!mfQ2");
    expect(await verifyPassword("Xk9!mfQ2", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
