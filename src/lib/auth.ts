import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * Resolves the current request's Supabase session into our own User row.
 * Returns null if there's no session, or if a session exists but the
 * corresponding User row hasn't been created yet (shouldn't happen once
 * src/app/auth/callback/route.ts has run, but callers should still handle it).
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  return prisma.user.findUnique({
    where: { id: authUser.id },
    include: {
      verifications: true,
      parentLinksAsParent: {
        include: { studentRecord: { include: { universityDomain: true } } },
      },
      homeCity: { include: { region: true } },
      studentRecord: { include: { universityDomain: { include: { region: true } } } },
    },
  });
}

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

/** True once VerificationRecord(type=university, status=verified) exists. */
export function isUniversityVerified(user: CurrentUser): boolean {
  return user.verifications.some(
    (v) => v.type === "university" && v.status === "verified",
  );
}

/** e.g. "✓ UC Irvine Verified", or null if not yet verified. */
export function universityBadgeLabel(user: CurrentUser): string | null {
  const record = user.verifications.find(
    (v) => v.type === "university" && v.status === "verified",
  );
  if (!record) return null;
  const universityName = (record.metadata as { university?: string } | null)
    ?.university;
  return `✓ ${universityName ?? "University"} Verified`;
}

/**
 * e.g. "✓ Verified Parent of UC Irvine Student", or null. Distinct from
 * isUniversityVerified/universityBadgeLabel above -- a parent's OWN email
 * is never expected to be a university address, so this is a separate
 * VerificationRecord type (parent_relationship) granted when a
 * ParentStudentLink successfully OTP-confirms (see
 * src/app/api/family/parent-link/confirm/route.ts), not when the parent's
 * own email domain matches. A parent can hold both badges if they happen to
 * have also verified their own .edu email, but normally only this one.
 */
export function parentRelationshipBadgeLabel(user: CurrentUser): string | null {
  const record = user.verifications.find(
    (v) => v.type === "parent_relationship" && v.status === "verified",
  );
  if (!record) return null;
  const universityName = (record.metadata as { university?: string } | null)
    ?.university;
  return `✓ Verified Parent of ${universityName ?? "University"} Student`;
}

/**
 * True once this account has at least one non-revoked ParentStudentLink
 * (otp_verified or approved) to ANY student. This is the entry gate for a
 * parent-signup account: per product decision, a parent must have a
 * university-email-verified student linked before they can use the app AT
 * ALL -- not just before posting "for" that student. Mirrors how
 * isUniversityVerified gates a student account. See the redirect check in
 * src/app/layout.tsx, which is what actually enforces this.
 */
export function hasLinkedStudent(user: CurrentUser): boolean {
  return user.parentLinksAsParent.some((link) => link.status !== "revoked");
}

/**
 * True once a parent has proven access to a SPECIFIC student's university
 * inbox via OTP (status otp_verified or approved) and that link hasn't been
 * revoked — this is the finer-grained check for posting a Request "for"
 * that particular student (distinct from hasLinkedStudent above, which only
 * checks "linked to *someone*" for the app-wide entry gate). Deliberately
 * does not require `approved` — see the security note on ParentStudentLink
 * in prisma/schema.prisma for why OTP possession alone is treated as
 * sufficient for this narrow, publicly-labeled capability, and what
 * mitigates the interim trust gap.
 */
/**
 * True once the post-signup onboarding form (student: /onboarding, parent:
 * step 0 of /family/connect-student) has been submitted at least once. This
 * is deliberately a soft signal, not an enforced gate like hasLinkedStudent
 * -- src/app/layout.tsx uses it only to decide whether to show a
 * "complete your profile" nudge, never to block navigation.
 */
export function hasCompletedOnboarding(user: CurrentUser): boolean {
  return user.onboardingCompletedAt !== null;
}

/**
 * True once this account has a claimed StudentRecord (StudentRecord.userId
 * = this user's id) -- i.e. they signed up with, or later verified, an
 * actual university email, per claimOrCreateStudentRecord in
 * src/lib/onboarding.ts. This is the precise definition of "a student" used
 * to gate students-only posts (Trip.studentsOnly / Request.studentsOnly,
 * see the schema comment on the latter): narrower than "didn't sign up as a
 * parent" (!signedUpAsParent), since an alumni/traveler account that never
 * verified a university email doesn't count either. getCurrentUser()
 * already includes studentRecord, so this needs no extra query.
 */
export function hasStudentRecord(user: CurrentUser): boolean {
  return user.studentRecord !== null;
}

export async function canActOnBehalfOf(
  parentUserId: string,
  studentRecordId: string,
) {
  const link = await prisma.parentStudentLink.findUnique({
    where: {
      parentId_studentRecordId: { parentId: parentUserId, studentRecordId },
    },
  });
  return link !== null && link.status !== "revoked";
}
