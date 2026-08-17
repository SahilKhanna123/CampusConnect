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
    include: { verifications: true },
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
 * True once a parent has proven access to a student's university inbox via
 * OTP (status otp_verified or approved) and the link hasn't been revoked —
 * this is what gates posting a Request "for" that student. It does NOT gate
 * anything else a parent can do (their own trips/requests need no link at
 * all), and it deliberately does not require `approved` — see the security
 * note on ParentStudentLink in prisma/schema.prisma for why OTP possession
 * alone is treated as sufficient for this one, narrow, publicly-labeled
 * capability, and what mitigates the interim trust gap.
 */
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
