import { describe, it, expect, beforeEach } from "vitest";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { resetAndSeed } from "@/lib/testDb";
import { createUser, createUniversityDomain } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { claimOrCreateStudentRecord, syncUserFromAuth } from "./onboarding";

function makeAuthUser(
  overrides: Partial<SupabaseUser> & { id: string; email: string },
): SupabaseUser {
  const now = new Date().toISOString();
  return {
    aud: "authenticated",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
    ...overrides,
  } as SupabaseUser;
}

// Turns the two StudentRecord races documented on claimOrCreateStudentRecord
// (schema.prisma's comment on StudentRecord, and this function's own
// comment) -- previously verified only once by hand with a manual
// Promise.all during development -- into an automated regression test. This
// is also the first *.db.test.ts file: a good smoke test for the whole
// Docker/testDb/testDbFixtures pipeline (see vitest.config.db.mts).

let domain: Awaited<ReturnType<typeof createUniversityDomain>>;

beforeEach(async () => {
  await resetAndSeed();
  domain = await createUniversityDomain({ domain: "race-test.edu" });
});

describe("claimOrCreateStudentRecord -- concurrent CREATE race", () => {
  it("N concurrent calls for the same not-yet-existing email create exactly one row, none throw", async () => {
    const email = "student@race-test.edu";
    // Distinct real Users, each attempting to claim the SAME email at the
    // same moment -- mirrors the function's own documented scenario: a
    // parent's OTP-confirm landing at the same instant the real student
    // finishes their own signup.
    const users = await Promise.all(
      Array.from({ length: 8 }, () => createUser()),
    );

    const attempts = users.map((user) =>
      claimOrCreateStudentRecord({
        email,
        fullName: "Race Student",
        universityDomainId: domain.id,
        userId: user.id,
      }),
    );

    // Every caller must resolve without throwing -- a naive find-then-create
    // (instead of the real create-then-catch-P2002-then-refetch pattern)
    // would let the unique-constraint violation leak past the catch for
    // every loser of the race.
    await expect(Promise.all(attempts)).resolves.toBeDefined();

    const matching = await prisma.studentRecord.findMany({
      where: { universityEmail: email },
    });
    expect(matching).toHaveLength(1);
    // Exactly one of the N racing users ends up as the claimant -- which one
    // is nondeterministic under real concurrency, but it must be exactly one
    // of them, never null and never an id outside the set.
    expect(matching[0].userId).not.toBeNull();
    expect(users.map((u) => u.id)).toContain(matching[0].userId);
  });
});

describe("claimOrCreateStudentRecord -- concurrent CLAIM race", () => {
  it("N concurrent claims of one pre-existing unclaimed record result in exactly one claimant", async () => {
    const email = "unclaimed@race-test.edu";
    // Pre-create the record already unclaimed (userId: null) -- the "a
    // parent created this before the student ever signed up" scenario.
    await claimOrCreateStudentRecord({
      email,
      fullName: "Unclaimed Student",
      universityDomainId: domain.id,
      // no userId -- created unclaimed
    });

    const users = await Promise.all(
      Array.from({ length: 8 }, () => createUser()),
    );

    const attempts = users.map((user) =>
      claimOrCreateStudentRecord({
        email,
        fullName: "Unclaimed Student",
        universityDomainId: domain.id,
        userId: user.id,
      }),
    );

    // Every "losing" claimant must resolve silently (the conditional
    // updateMany WHERE userId IS NULL simply affects 0 rows for them), not
    // throw and not overwrite the winner's claim.
    await expect(Promise.all(attempts)).resolves.toBeDefined();

    const matching = await prisma.studentRecord.findMany({
      where: { universityEmail: email },
    });
    expect(matching).toHaveLength(1);
    expect(matching[0].userId).not.toBeNull();
    expect(users.map((u) => u.id)).toContain(matching[0].userId);
  });

  it("a claim never overwrites an already-different claimant", async () => {
    const email = "already-claimed@race-test.edu";
    const firstOwner = await createUser();
    const intruder = await createUser();

    await claimOrCreateStudentRecord({
      email,
      fullName: "Already Claimed Student",
      universityDomainId: domain.id,
      userId: firstOwner.id,
    });

    // A second, different user attempting to claim the same (now-claimed)
    // email must silently no-op, not steal the claim.
    await claimOrCreateStudentRecord({
      email,
      fullName: "Already Claimed Student",
      universityDomainId: domain.id,
      userId: intruder.id,
    });

    const record = await prisma.studentRecord.findUniqueOrThrow({
      where: { universityEmail: email },
    });
    expect(record.userId).toBe(firstOwner.id);
  });
});

describe("syncUserFromAuth -- idempotency", () => {
  it("calling it twice for the same auth user doesn't error or duplicate rows", async () => {
    const authUser = makeAuthUser({
      id: "auth-user-1",
      email: `newstudent@${domain.domain}`,
      user_metadata: { full_name: "Jordan Student" },
    });

    await syncUserFromAuth(authUser);
    await syncUserFromAuth(authUser);

    const users = await prisma.user.findMany({ where: { id: authUser.id } });
    expect(users).toHaveLength(1);

    const emailVerifications = await prisma.verificationRecord.findMany({
      where: { userId: authUser.id, type: "email" },
    });
    expect(emailVerifications).toHaveLength(1);

    const universityVerifications = await prisma.verificationRecord.findMany({
      where: { userId: authUser.id, type: "university" },
    });
    expect(universityVerifications).toHaveLength(1);

    const studentRecords = await prisma.studentRecord.findMany({
      where: { universityEmail: `newstudent@${domain.domain}` },
    });
    expect(studentRecords).toHaveLength(1);
    expect(studentRecords[0].userId).toBe(authUser.id);
  });
});
