import { NextResponse } from "next/server";

// POST /api/family/invite/accept
// Body: { token: string }
// UPDATED ASSUMPTION: parents can now fully self-signup independently (see
// src/app/(auth)/sign-up/page.tsx) -- this is no longer the only path to a
// parent account existing. This route now needs to find-or-require the
// caller's own account (they may already have signed up separately) rather
// than assume it's creating one, and should require accepting with the
// EXACT invited email (proven via their own Supabase signup/login, same
// standard as the OTP path proves student-email access) rather than skip
// verification.
// TODO: validate invite token (not expired/used); require the authenticated
// caller's email to match ParentStudentInvite.parentEmail exactly; find the
// inviting student's own StudentRecord (they already have one -- every
// student signup creates/claims one, see src/lib/onboarding.ts) and create
// ParentStudentLink(studentRecordId, status=approved) -- approved, not
// otp_verified, since the student's own initiating action is already
// unambiguous consent in this direction (asymmetric from the parent-
// initiated OTP flow, see the security note on ParentStudentLink in
// prisma/schema.prisma); mark ParentStudentInvite.status=accepted.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
