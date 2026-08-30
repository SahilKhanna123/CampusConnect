import type { CurrentUser } from "@/lib/auth";

// Shared factory for building a fully-typed CurrentUser fixture for unit
// tests -- NOT itself a *.test.ts file, so Vitest never tries to run it as
// a suite. CurrentUser is inferred from getCurrentUser()'s Prisma query
// (User + verifications/parentLinksAsParent/homeCity/studentRecord), so a
// literal object needs every one of those fields to satisfy the type --
// this factory supplies sensible, mostly-empty defaults for all of them so
// individual tests only need to override the 1-2 fields they actually
// care about (e.g. `verifications`, `studentRecord`), rather than
// re-specifying the whole shape every time. Keeping this in sync with the
// User model is the tradeoff for that convenience -- a schema change that
// breaks this factory will fail loudly at compile time (tsc/vitest both
// type-check test files), not silently.
export function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    photoUrl: null,
    collegeName: null,
    homeRegionId: null,
    homeCityId: null,
    onboardingCompletedAt: null,
    major: null,
    year: null,
    travelPreferences: null,
    lookingFor: [],
    phone: null,
    linkedStudentName: null,
    signedUpAsParent: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    verifications: [],
    parentLinksAsParent: [],
    homeCity: null,
    studentRecord: null,
    ...overrides,
  };
}

/** Minimal verified VerificationRecord fixture, university or parent_relationship type. */
export function makeVerification(
  overrides: Partial<CurrentUser["verifications"][number]> = {},
): CurrentUser["verifications"][number] {
  return {
    id: "verification-1",
    userId: "user-1",
    type: "university",
    status: "verified",
    verifiedValue: null,
    metadata: null,
    token: null,
    tokenExpiresAt: null,
    verifiedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Minimal claimed StudentRecord fixture (with its required universityDomain include). */
export function makeStudentRecord(
  overrides: Partial<NonNullable<CurrentUser["studentRecord"]>> = {},
): NonNullable<CurrentUser["studentRecord"]> {
  return {
    id: "student-record-1",
    fullName: "Test Student",
    universityEmail: "student@uci.edu",
    universityDomainId: "domain-1",
    universityDomain: {
      id: "domain-1",
      domain: "uci.edu",
      universityName: "UC Irvine",
      regionId: "region-1",
      region: { id: "region-1", name: "UC Irvine Area", slug: "uci" },
    },
    universityEmailVerifiedAt: new Date("2026-01-01"),
    userId: "user-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** Minimal ParentStudentLink fixture (with its required nested studentRecord.universityDomain include). */
export function makeParentLink(
  overrides: Partial<CurrentUser["parentLinksAsParent"][number]> = {},
): CurrentUser["parentLinksAsParent"][number] {
  return {
    id: "link-1",
    parentId: "user-1",
    studentRecordId: "student-record-1",
    studentRecord: makeStudentRecord(),
    status: "otp_verified",
    objectionToken: null,
    otpVerifiedAt: new Date("2026-01-01"),
    approvedAt: null,
    revokedAt: null,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}
