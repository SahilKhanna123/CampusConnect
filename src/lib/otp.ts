import { randomInt, randomBytes, createHash } from "crypto";

// 8 digits, matching Supabase's own account-email OTP convention (see the
// comment in src/app/(auth)/sign-up/page.tsx) -- one consistent mental model
// across the app rather than mixing code lengths.
const OTP_LENGTH = 8;
export const OTP_TTL_MINUTES = 20;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtpCode(): string {
  let code = "";
  for (let i = 0; i < OTP_LENGTH; i++) code += randomInt(0, 10).toString();
  return code;
}

// Hashed at rest -- unlike the long random hex tokens used elsewhere in this
// app (e.g. VerificationRecord.token), a short numeric code is meaningfully
// brute-forceable, so a leaked DB shouldn't hand over usable codes.
export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export function generateObjectionToken(): string {
  return randomBytes(32).toString("hex");
}
