import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Lands here after a user clicks the Supabase confirmation link from
// signUp() (or, later, an OAuth/magic-link flow) — @supabase/ssr uses the
// PKCE flow, so the link carries a `code` to exchange for a session.
//
// On first arrival for a given Supabase Auth user, this is also where the
// corresponding Prisma User row is created — Supabase's own account exists
// in auth.users, which Prisma doesn't manage, so app code is what bridges
// the two. Since reaching this route means Supabase already confirmed
// control of the email, we also record VerificationRecord(type=email) here
// rather than reinventing basic email verification.
//
// Signup email IS the university-verification input: there's no separate
// "enter your .edu address" step for the primary flow. If the confirmed
// email's domain matches a SupportedUniversityDomain, the university badge
// is granted right here, same trip. This only auto-verifies accounts that
// signed up directly with a supported .edu address — someone who signs up
// with a personal email lands on "/" unverified and can still add a
// university badge later via the standalone /verify form, which stays in
// place as a self-serve fallback (e.g. for alumni, or a mistyped domain).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-up?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/sign-up?error=auth_failed`);
  }

  const { user: authUser } = data;
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

  return NextResponse.redirect(`${origin}${next}`);
}
