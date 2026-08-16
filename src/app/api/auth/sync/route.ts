import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserFromAuth } from "@/lib/onboarding";

// POST /api/auth/sync
// Called from the client immediately after supabase.auth.verifyOtp()
// succeeds — verifyOtp() runs entirely client-side and establishes a
// session via cookies (the @supabase/ssr browser client syncs auth state to
// cookies automatically), but nothing about it touches our own database.
// This route reads that now-authenticated session server-side and runs the
// same onboarding bridge the link-based /auth/callback route uses.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await syncUserFromAuth(authUser);

  return NextResponse.json({ ok: true });
}
