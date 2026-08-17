import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashOtpCode, generateObjectionToken, OTP_MAX_ATTEMPTS } from "@/lib/otp";
import { claimOrCreateStudentRecord } from "@/lib/onboarding";
import { sendParentConnectionNoticeEmail } from "@/lib/email";

const bodySchema = z.object({
  studentEmail: z.string().email(),
  code: z.string().min(1),
});

// POST /api/family/parent-link/confirm
// Body: { studentEmail: string, code: string }
// On success: finds-or-creates the StudentRecord (via the shared, race-safe
// claimOrCreateStudentRecord — see src/lib/onboarding.ts), creates
// ParentStudentLink(status=otp_verified), and sends the student-facing
// notice email with the no-account-required objection link. This is the
// ONLY place a StudentRecord gets created from the parent-initiated
// direction — never at request-time, only at confirmed-OTP time.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const studentEmail = parsed.data.studentEmail.trim().toLowerCase();
  const code = parsed.data.code.trim();

  const pending = await prisma.parentStudentOtpRequest.findFirst({
    where: { parentId: user.id, studentEmail },
    orderBy: { createdAt: "desc" },
    include: { universityDomain: true },
  });

  if (!pending) {
    return NextResponse.json(
      { error: "No pending verification for this email. Request a new code." },
      { status: 400 },
    );
  }

  if (pending.otpExpiresAt < new Date()) {
    await prisma.parentStudentOtpRequest.delete({ where: { id: pending.id } });
    return NextResponse.json(
      { error: "This code has expired. Request a new one." },
      { status: 400 },
    );
  }

  if (pending.attemptCount >= OTP_MAX_ATTEMPTS) {
    await prisma.parentStudentOtpRequest.delete({ where: { id: pending.id } });
    return NextResponse.json(
      { error: "Too many incorrect attempts. Request a new code." },
      { status: 429 },
    );
  }

  if (hashOtpCode(code) !== pending.otpCodeHash) {
    await prisma.parentStudentOtpRequest.update({
      where: { id: pending.id },
      data: { attemptCount: { increment: 1 } },
    });
    return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
  }

  const studentRecord = await claimOrCreateStudentRecord({
    email: studentEmail,
    fullName: studentEmail.split("@")[0],
    universityDomainId: pending.universityDomainId,
    // No userId -- this student may not have an account yet. If they
    // already do, syncUserFromAuth already claimed this record on their own
    // signup, and claimOrCreateStudentRecord's find-first path is a no-op
    // here since it only claims when a userId is passed.
  });

  // A previously-revoked link (e.g. the student used the objection link)
  // must not silently re-establish via this same OTP mechanism -- that
  // would defeat the whole point of the objection link being a real "stop"
  // rather than a snooze. Re-connecting after a revocation isn't built yet
  // (would need a path that routes through the student's own confirmation,
  // not just the parent re-proving inbox access) -- reject clearly for now.
  const existingLink = await prisma.parentStudentLink.findUnique({
    where: {
      parentId_studentRecordId: {
        parentId: user.id,
        studentRecordId: studentRecord.id,
      },
    },
  });
  if (existingLink?.status === "revoked") {
    return NextResponse.json(
      {
        error:
          "This connection was previously removed and can't be re-established this way.",
      },
      { status: 403 },
    );
  }

  const objectionToken = generateObjectionToken();

  const link = await prisma.parentStudentLink.upsert({
    where: {
      parentId_studentRecordId: {
        parentId: user.id,
        studentRecordId: studentRecord.id,
      },
    },
    update: {
      status: "otp_verified",
      otpVerifiedAt: new Date(),
      objectionToken,
    },
    create: {
      parentId: user.id,
      studentRecordId: studentRecord.id,
      status: "otp_verified",
      otpVerifiedAt: new Date(),
      objectionToken,
    },
  });

  await prisma.parentStudentOtpRequest.delete({ where: { id: pending.id } });

  const objectionUrl = `${new URL(request.url).origin}/family/link-objection?token=${link.objectionToken}`;
  // Notice email failing shouldn't roll back a link that's otherwise
  // legitimately established -- log and continue rather than throw.
  try {
    await sendParentConnectionNoticeEmail({
      to: studentEmail,
      parentName: user.name,
      objectionUrl,
    });
  } catch (err) {
    console.error("Failed to send parent-connection notice email:", err);
  }

  return NextResponse.json({ ok: true, studentRecordId: studentRecord.id });
}
