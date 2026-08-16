import { NextResponse } from "next/server";

// POST /api/verification/university/request
// Body: { email: string }
// TODO: check domain against SupportedUniversityDomain, create a signed
// single-use expiring token on VerificationRecord(type=university, status=pending),
// send the confirmation email via Resend.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
