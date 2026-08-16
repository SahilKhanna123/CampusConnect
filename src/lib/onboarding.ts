import type { User as SupabaseUser } from "@supabase/supabase-js";
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
  }
}
