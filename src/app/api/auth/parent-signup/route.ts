import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

// POST /api/auth/parent-signup
// Body: { name, email, password }
// Creates a Supabase Auth user with email_confirm: true -- a parent doesn't
// need to prove they can receive mail at their own address before using
// the app; the security-critical verification in this product is the
// student's *university* email (still fully rigorous, untouched, see
// src/app/api/family/parent-link/{request,confirm}). This is a narrow,
// deliberate bypass scoped to this one route via the admin API, not a
// project-wide relaxation -- students keep the normal
// supabase.auth.signUp() + confirm flow in src/app/(auth)/sign-up/page.tsx
// completely unchanged.
// The client is expected to immediately follow this with
// supabase.auth.signInWithPassword() using the same credentials to
// establish a real session, then POST /api/auth/sync.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid signup details" }, { status: 400 });
  }
  const { name, email, password } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // persona: 'parent' travels through to syncUserFromAuth (src/lib/onboarding.ts),
    // which reads it to set User.signedUpAsParent -- the flag that decides
    // whether the "must link a student before using the app" gate applies.
    user_metadata: { full_name: name, persona: "parent" },
  });

  if (error) {
    // Supabase returns a generic-enough message for "already registered"
    // etc. -- pass it through rather than re-deriving our own copy.
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
