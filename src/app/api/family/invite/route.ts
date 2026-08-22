import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isUniversityVerified } from "@/lib/auth";
import { sendParentInviteEmail } from "@/lib/email";

const bodySchema = z.object({ parentEmail: z.string().email() });
const INVITE_TTL_DAYS = 7;

// POST /api/family/invite
// Body: { parentEmail: string }
// Caller must be an authenticated, university-verified student -- the
// student-initiated direction, distinct from the parent-initiated OTP flow
// (src/app/api/family/parent-link/{request,confirm}/route.ts). Requiring
// isUniversityVerified here (rather than just "has a StudentRecord") is
// deliberate: a StudentRecord can exist unclaimed (a parent created it
// first) or claimed-but-unverified in edge cases, and this is the one
// direction where the STUDENT is vouching for the connection, so their own
// university verification is the meaningful gate, not the parent's.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isUniversityVerified(user)) {
    return NextResponse.json(
      {
        error:
          "Verify your university email before inviting a parent/guardian.",
      },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  const parentEmail = parsed.data.parentEmail.trim().toLowerCase();

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // A student may retry with a corrected address, or re-invite after their
  // first invite expired -- clear old PENDING invites to this exact address
  // first (same "clean up stale unconsumed state before creating fresh
  // state" convention as ParentStudentOtpRequest above). Never touches
  // already-accepted/revoked rows -- those are real history, not stale.
  await prisma.parentStudentInvite.deleteMany({
    where: { studentId: user.id, parentEmail, status: "pending" },
  });
  await prisma.parentStudentInvite.create({
    data: { studentId: user.id, parentEmail, token, expiresAt },
  });

  const acceptUrl = `${new URL(request.url).origin}/family/invite/accept?token=${token}`;
  try {
    await sendParentInviteEmail({
      to: parentEmail,
      studentName: user.name,
      acceptUrl,
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't send the invite email. Try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
