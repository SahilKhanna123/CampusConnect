import { NextResponse } from "next/server";

// POST /api/blocks
// Body: { blockedId: string }
// TODO: create Block row. Enforce bidirectionally at query time in
// search/messaging (hide each user from the other) — reviews/trip history
// between them remain visible per the resolved default (plan doc, Decisions Log #13).
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
