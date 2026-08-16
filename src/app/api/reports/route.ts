import { NextResponse } from "next/server";

// POST /api/reports
// Body: { reportedUserId, reason, detail?, contextType?, contextId? }
// TODO: create Report(status=open) for manual/admin review — no automated
// suspension logic in MVP.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
