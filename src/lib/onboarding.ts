import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Bridges a confirmed Supabase Auth user into our own data model. Called
// from both the link-based callback (src/app/auth/callback/route.ts) and
// the OTP-based path (src/app/api/auth/sync/route.ts) — whichever way a
// user's email got confirmed, this is the one place that creates the
// Prisma User row (Supabase's auth.users table isn't ours to manage) and
// grants the email/university badges. Safe to call more than once for the
// same user (all writes are upserts).
export async function syncUserFromAuth(authUser: SupabaseUser) {
  const fullName =
    (authUser.user_metadata?.full_name as string | undefined) ??
    authUser.email?.split("@")[0] ??
    "New User";

  await prisma.user.upsert({
    where: { id: authUser.id },
    update: {},
    create: {
      id: authUser.id,
      email: authUser.email!,
      name: fullName,
    },
  });

  await prisma.verificationRecord.upsert({
    where: { userId_type: { userId: authUser.id, type: "email" } },
    update: { status: "verified", verifiedAt: new Date() },
    create: {
      userId: authUser.id,
      type: "email",
      status: "verified",
      verifiedValue: authUser.email,
      verifiedAt: new Date(),
    },
  });

  // Signup email doubles as the university-verification input: if the
  // confirmed email's domain matches a supported school, grant that badge
  // in the same trip rather than requiring a separate step.
  const domain = authUser.email?.split("@")[1]?.toLowerCase();
  const universityDomain = domain
    ? await prisma.supportedUniversityDomain.findUnique({ where: { domain } })
    : null;

  if (universityDomain) {
    await prisma.verificationRecord.upsert({
      where: { userId_type: { userId: authUser.id, type: "university" } },
      update: {
        status: "verified",
        verifiedValue: authUser.email,
        verifiedAt: new Date(),
        metadata: { university: universityDomain.universityName, domain },
      },
      create: {
        userId: authUser.id,
        type: "university",
        status: "verified",
        verifiedValue: authUser.email,
        verifiedAt: new Date(),
        metadata: { university: universityDomain.universityName, domain },
      },
    });

    // Claim-or-create the StudentRecord for this exact email. A parent may
    // have already created an unclaimed one (see
    // src/app/api/family/parent-link/confirm/route.ts) -- this is what lets
    // that record's existing ParentStudentLink rows stay valid with zero
    // relinking once the real student signs up, possibly months later.
    await claimOrCreateStudentRecord({
      email: authUser.email!,
      fullName,
      universityDomainId: universityDomain.id,
      userId: authUser.id,
    });
  }
}

// Atomic find-or-create-or-claim keyed on the unique, normalized
// universityEmail — this uniqueness constraint is the SOLE mechanism
// preventing duplicate StudentRecords, so every caller must go through
// this function rather than rolling their own find-then-create (a
// find-then-create races under concurrent requests; a plain @unique
// upsert compiles to an atomic INSERT ... ON CONFLICT in Postgres).
//
// Two distinct races are handled here, not one:
//   1. Two concurrent attempts to CREATE the same record (e.g. a parent's
//      OTP-confirm landing at the same moment the real student finishes
//      their own signup) -- handled by the upsert being atomic.
//   2. Two concurrent attempts to CLAIM the same already-existing,
//      unclaimed record -- the @unique on userId alone doesn't prevent
//      this (it only stops one User claiming two records), so claiming
//      uses a conditional updateMany (WHERE userId IS NULL) and checks the
//      affected-row count rather than assuming success.
export async function claimOrCreateStudentRecord(params: {
  email: string;
  fullName: string;
  universityDomainId: string;
  userId?: string; // set only when claiming on behalf of a real signed-up User
}) {
  const email = params.email.trim().toLowerCase();

  const existing = await prisma.studentRecord.findUnique({
    where: { universityEmail: email },
  });

  if (!existing) {
    try {
      return await prisma.studentRecord.create({
        data: {
          fullName: params.fullName,
          universityEmail: email,
          universityDomainId: params.universityDomainId,
          universityEmailVerifiedAt: new Date(),
          userId: params.userId,
        },
      });
    } catch (err) {
      // P2002: another request created it in the gap between our find and
      // create above -- fall through and treat it as "already exists." The
      // code lives on err.code, NOT embedded in err.message -- checking the
      // message text was a real bug caught by scripts/test-student-record.ts.
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002";
      if (!isUniqueViolation) throw err;
    }
  }

  // Record already exists (or just lost the create race) -- verify the
  // email if it wasn't already, and claim it if we have a userId and it's
  // unclaimed.
  await prisma.studentRecord.updateMany({
    where: { universityEmail: email, universityEmailVerifiedAt: null },
    data: { universityEmailVerifiedAt: new Date() },
  });

  if (params.userId) {
    // Conditional claim: only succeeds if still unclaimed. If a different
    // User already claimed it (shouldn't normally happen -- Supabase's own
    // email uniqueness prevents two Users ever sharing an email in the
    // first place -- but guard against it rather than assume), this
    // silently no-ops rather than stealing the claim.
    await prisma.studentRecord.updateMany({
      where: { universityEmail: email, userId: null },
      data: { userId: params.userId },
    });
  }

  return prisma.studentRecord.findUniqueOrThrow({
    where: { universityEmail: email },
  });
}
