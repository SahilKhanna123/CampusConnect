import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserFromAuth } from "@/lib/onboarding";

// Lands here after a user clicks the Supabase confirmation link from
// signUp() (or, later, an OAuth/magic-link flow) — @supabase/ssr uses the
// PKCE flow, so the link carries a `code` to exchange for a session.
//
// This is one of TWO paths that can complete signup — the other is OTP-based
// (src/app/api/auth/sync/route.ts, driven from the sign-up page itself).
// Both exist because email security scanners at some domains (notably many
// .edu mail gateways) pre-fetch links in incoming mail to scan them, which
// silently consumes this route's single-use token before the real user ever
// clicks it — confirmed by a real test where Supabase's own
// confirmation_sent_at/email_confirmed_at were 7 seconds apart. The OTP path
// is immune to that since a scanner can't type a code into a form. Keep
// both: the link still works fine for domains without aggressive prefetching.
//
// Either way, syncUserFromAuth (src/lib/onboarding.ts) is what actually
// creates the Prisma User row and grants verification badges — Supabase's
// own account lives in auth.users, which Prisma doesn't manage.
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

  await syncUserFromAuth(data.user);

  return NextResponse.redirect(`${origin}${next}`);
}
