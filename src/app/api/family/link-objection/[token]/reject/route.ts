import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/family/link-objection/:token/reject
// Deliberately public/no-auth -- the whole point of the objection link is
// that a student who never signed up can still shut down an unwanted
// connection. Deliberately a POST, not a GET, and only ever called from an
// explicit button click on /family/link-objection (never auto-fired on
// page load) -- email security scanners are known to pre-fetch links
// (confirmed firsthand in this project), and a GET that auto-revokes would
// let a scanner falsely reject a legitimate connection.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const link = await prisma.parentStudentLink.findUnique({
    where: { objectionToken: token },
  });

  if (!link) {
    return NextResponse.json(
      { error: "This link is invalid or has already been used." },
      { status: 400 },
    );
  }

  await prisma.parentStudentLink.update({
    where: { id: link.id },
    data: { status: "revoked", revokedAt: new Date(), objectionToken: null },
  });

  return NextResponse.json({ ok: true });
}
