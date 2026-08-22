import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/family/link/:id/approve
// Caller must be the User whose claimed StudentRecord this link points at
// (link.studentRecord.userId === current user's id) -- not the parent, and
// not reachable at all until the student has an account and has claimed
// their StudentRecord. Not the gate that unlocks a parent's posting
// capability -- that already happens at status=otp_verified, once the
// parent proves access to the student's inbox (see
// src/app/api/family/parent-link/confirm/route.ts and the security note on
// ParentStudentLink in prisma/schema.prisma). This route is the student's
// explicit upgrade from otp_verified to approved (full mutual trust) --
// only meaningful for links created via the parent-initiated OTP flow,
// since the student-initiated invite direction already creates links at
// approved directly (see POST /api/family/invite/accept).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const link = await prisma.parentStudentLink.findUnique({
    where: { id },
    include: { studentRecord: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (link.studentRecord.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (link.status !== "otp_verified") {
    return NextResponse.json(
      { error: "This connection can't be approved right now." },
      { status: 400 },
    );
  }

  await prisma.parentStudentLink.update({
    where: { id },
    data: { status: "approved", approvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
