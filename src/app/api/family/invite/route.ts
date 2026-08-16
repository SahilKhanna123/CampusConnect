import { NextResponse } from "next/server";

// POST /api/family/invite
// Body: { parentEmail: string }
// Caller must be an authenticated, university-verified student.
// TODO: create ParentStudentInvite (token, expiresAt), email the parent via Resend.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
