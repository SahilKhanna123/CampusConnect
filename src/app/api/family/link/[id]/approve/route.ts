import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// POST /api/family/link/:id/approve
// Caller must be the User whose claimed StudentRecord this link points at
// (link.studentRecord.userId === caller.id) -- the student's explicit
// upgrade of an existing ParentStudentLink from otp_verified to approved.
// Not the gate that unlocks a parent's posting capability -- that already
// happens at otp_verified (see the security note on ParentStudentLink in
// prisma/schema.prisma); this is full mutual trust confirmation on top of
// that. Deliberately does NOT wire a VerificationRecord on either user's
// side -- the stub's own TODO only hedged ("consider"), and there's no
// existing student-side badge concept/UI anywhere to display one; the
// parent already got their parent_relationship badge at otp_verified time.
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
      { error: "This link can't be approved right now." },
      { status: 400 },
    );
  }

  const resolved = await prisma.parentStudentLink.updateMany({
    where: { id, status: "otp_verified" },
    data: { status: "approved", approvedAt: new Date() },
  });
  if (resolved.count === 0) {
    return NextResponse.json(
      { error: "This link can't be approved right now." },
      { status: 400 },
    );
  }

  await createNotification({
    userId: link.parentId,
    type: "parent_link_approved",
    title: "Connection approved",
    message: `${user.name} approved your parent connection.`,
  });

  return NextResponse.json({ ok: true });
}
