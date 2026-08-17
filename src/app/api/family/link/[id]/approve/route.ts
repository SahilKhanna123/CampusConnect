import { NextResponse } from "next/server";

// POST /api/family/link/:id/approve
// Caller must be the User whose claimed StudentRecord this link points at
// (link.studentRecord.userId === current user's id).
// UPDATED: no longer the gate that unlocks a parent's posting capability --
// that already happens at status=otp_verified, once the parent proves
// access to the student's inbox (see src/app/api/family/parent-link/confirm
// and the security note on ParentStudentLink in prisma/schema.prisma).
// This route is the student's explicit upgrade from otp_verified to
// approved (full mutual trust, e.g. removes the "connection not yet
// confirmed" label future Request/Post UI should show for otp_verified-only
// links). Also relevant for a StudentRecord a parent created before the
// student had an account: once the student claims it (signs up with the
// matching email, see src/lib/onboarding.ts claimOrCreateStudentRecord),
// any pre-existing otp_verified links should be surfaced here for review.
// TODO: set ParentStudentLink.status=approved, approvedAt=now(); consider
// wiring VerificationRecord(type=parent_relationship) on both the parent's
// and student's User at this point, mirroring the university-badge pattern.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
