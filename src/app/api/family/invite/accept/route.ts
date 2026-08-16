import { NextResponse } from "next/server";

// POST /api/family/invite/accept
// Body: { token: string }
// This is where a parent account is created/attached — there is no separate
// general parent-signup endpoint. Creates ParentStudentLink(status=pending_student_approval).
// TODO: validate invite token (not expired/used), create/attach the parent
// User, mark ParentStudentInvite.status=accepted, create the pending link.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
