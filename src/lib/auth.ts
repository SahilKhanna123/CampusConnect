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
