import { NextResponse } from "next/server";

// POST /api/requests/:id/decline
// TODO: set Request.status=declined, respondedAt=now(). No capacity change.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
