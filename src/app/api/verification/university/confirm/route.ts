import { NextResponse } from "next/server";

// POST /api/verification/university/confirm
// Body: { token: string }
// TODO: look up VerificationRecord by token, check not expired/already used,
// set status=verified + verifiedAt, invalidate the token.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
