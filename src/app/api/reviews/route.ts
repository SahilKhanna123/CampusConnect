import { NextResponse } from "next/server";

// POST /api/reviews
// Body: { requestId: string, rating: number, comment?: string }
// TODO: enforce server-side (do not trust the client): Request.status must
// be 'completed', caller must be a participant (postedBy/beneficiary or the
// trip's traveler), and (requestId, reviewerId) must be unique — the schema's
// @@unique constraint backstops this but check it explicitly for a clean error.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
