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
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/verify";

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

  return NextResponse.redirect(`${origin}${next}`);
}
