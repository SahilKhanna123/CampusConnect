import { NextResponse } from "next/server";

// POST /api/requests/:id/complete
// Callable by either participant once the trip has happened.
// TODO: set Request.status=completed, completedAt=now(); this is what
// unlocks review eligibility for both participants (see /api/reviews).
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
