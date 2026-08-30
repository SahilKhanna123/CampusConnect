import { describe, it, expect } from "vitest";
import { generateOtpCode, hashOtpCode, generateObjectionToken } from "./otp";

describe("generateOtpCode", () => {
  it("generates an 8-digit numeric string", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{8}$/);
  });

  it("generates different codes across calls (not deterministic/constant)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateOtpCode()));
    // Astronomically unlikely to collide 20 times in a row if generation is
    // actually random -- this is a smoke check against an accidentally
    // hardcoded or non-random implementation, not a statistical proof.
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("hashOtpCode", () => {
  it("is deterministic -- the same input always hashes the same way", () => {
    expect(hashOtpCode("12345678")).toBe(hashOtpCode("12345678"));
  });

  it("produces a 64-character lowercase hex string (sha256)", () => {
    expect(hashOtpCode("12345678")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never stores the code in plaintext -- the hash isn't the code itself", () => {
    expect(hashOtpCode("12345678")).not.toBe("12345678");
  });

  it("different codes hash to different values", () => {
    expect(hashOtpCode("12345678")).not.toBe(hashOtpCode("87654321"));
  });
});

describe("generateObjectionToken", () => {
  it("generates a 64-character lowercase hex string (32 random bytes)", () => {
    expect(generateObjectionToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates different tokens across calls", () => {
    expect(generateObjectionToken()).not.toBe(generateObjectionToken());
  });
});
