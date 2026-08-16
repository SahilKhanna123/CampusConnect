import { NextResponse } from "next/server";

// GET /api/conversations/:id/messages?since=
// Client polls this on an interval while a thread is open (see plan doc §14
// — polling chosen over websockets for MVP). `since` supports incremental fetch.
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

// POST /api/conversations/:id/messages
// Body: { body: string }
// MVP is text-only; attachmentUrl/attachmentType columns exist for future use.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
