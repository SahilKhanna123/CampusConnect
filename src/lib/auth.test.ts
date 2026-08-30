import { describe, it, expect } from "vitest";
import {
  isUniversityVerified,
  universityBadgeLabel,
  parentRelationshipBadgeLabel,
  hasLinkedStudent,
  hasCompletedOnboarding,
  hasStudentRecord,
} from "./auth";
import { makeUser, makeVerification, makeParentLink, makeStudentRecord } from "./testFixtures";

describe("isUniversityVerified", () => {
  it("is false with no verifications at all", () => {
    expect(isUniversityVerified(makeUser())).toBe(false);
  });

  it("is true once a verified university VerificationRecord exists", () => {
    const user = makeUser({
      verifications: [makeVerification({ type: "university", status: "verified" })],
    });
    expect(isUniversityVerified(user)).toBe(true);
  });

  it("is false for a PENDING university verification -- verified is required", () => {
    const user = makeUser({
      verifications: [makeVerification({ type: "university", status: "pending" })],
    });
    expect(isUniversityVerified(user)).toBe(false);
  });

  it("is false for a verified record of a DIFFERENT type (e.g. parent_relationship)", () => {
    const user = makeUser({
      verifications: [
        makeVerification({ type: "parent_relationship", status: "verified" }),
      ],
    });
    expect(isUniversityVerified(user)).toBe(false);
  });
});

describe("universityBadgeLabel", () => {
  it("is null with no verified university record", () => {
    expect(universityBadgeLabel(makeUser())).toBeNull();
  });

  it("includes the university name from metadata when verified", () => {
    const user = makeUser({
      verifications: [
        makeVerification({
          type: "university",
          status: "verified",
          metadata: { university: "UC Irvine" },
        }),
      ],
    });
    expect(universityBadgeLabel(user)).toBe("✓ UC Irvine Verified");
  });

  it("falls back to a generic label when metadata has no university name", () => {
    const user = makeUser({
      verifications: [makeVerification({ type: "university", status: "verified" })],
    });
    expect(universityBadgeLabel(user)).toBe("✓ University Verified");
  });
});

describe("parentRelationshipBadgeLabel", () => {
  it("is null with no verified parent_relationship record", () => {
    expect(parentRelationshipBadgeLabel(makeUser())).toBeNull();
  });

  it("is null even when university IS verified -- these are distinct badge types", () => {
    const user = makeUser({
      verifications: [makeVerification({ type: "university", status: "verified" })],
    });
    expect(parentRelationshipBadgeLabel(user)).toBeNull();
  });

  it("includes the university name once parent_relationship is verified", () => {
    const user = makeUser({
      verifications: [
        makeVerification({
          type: "parent_relationship",
          status: "verified",
          metadata: { university: "UC Irvine" },
        }),
      ],
    });
    expect(parentRelationshipBadgeLabel(user)).toBe(
      "✓ Verified Parent of UC Irvine Student",
    );
  });
});

describe("hasLinkedStudent", () => {
  it("is false with no ParentStudentLinks at all", () => {
    expect(hasLinkedStudent(makeUser())).toBe(false);
  });

  it("is true with an otp_verified link", () => {
    const user = makeUser({
      parentLinksAsParent: [makeParentLink({ status: "otp_verified" })],
    });
    expect(hasLinkedStudent(user)).toBe(true);
  });

  it("is true with an approved link", () => {
    const user = makeUser({
      parentLinksAsParent: [makeParentLink({ status: "approved" })],
    });
    expect(hasLinkedStudent(user)).toBe(true);
  });

  it("is false when the only link is revoked", () => {
    const user = makeUser({
      parentLinksAsParent: [makeParentLink({ status: "revoked" })],
    });
    expect(hasLinkedStudent(user)).toBe(false);
  });

  it("is true when at least one of several links is non-revoked", () => {
    const user = makeUser({
      parentLinksAsParent: [
        makeParentLink({ id: "link-a", status: "revoked" }),
        makeParentLink({ id: "link-b", status: "approved" }),
      ],
    });
    expect(hasLinkedStudent(user)).toBe(true);
  });
});

describe("hasCompletedOnboarding", () => {
  it("is false when onboardingCompletedAt is null", () => {
    expect(hasCompletedOnboarding(makeUser({ onboardingCompletedAt: null }))).toBe(
      false,
    );
  });

  it("is true once onboardingCompletedAt is set", () => {
    const user = makeUser({ onboardingCompletedAt: new Date("2026-01-01") });
    expect(hasCompletedOnboarding(user)).toBe(true);
  });
});

describe("hasStudentRecord", () => {
  it("is false with no StudentRecord", () => {
    expect(hasStudentRecord(makeUser({ studentRecord: null }))).toBe(false);
  });

  it("is true with a claimed StudentRecord", () => {
    const user = makeUser({ studentRecord: makeStudentRecord() });
    expect(hasStudentRecord(user)).toBe(true);
  });

  it("does not conflate 'not a parent' with 'has a StudentRecord' -- an alumni/traveler with no verified university email still has none", () => {
    const user = makeUser({ signedUpAsParent: false, studentRecord: null });
    expect(hasStudentRecord(user)).toBe(false);
  });
});
