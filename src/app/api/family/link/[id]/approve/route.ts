import { NextResponse } from "next/server";

// POST /api/family/link/:id/approve
// Caller must be the student named on this ParentStudentLink.
// TODO: set ParentStudentLink.status=approved, approvedAt=now(). This is the
// gate that unlocks the parent account's posting/viewing capability.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
