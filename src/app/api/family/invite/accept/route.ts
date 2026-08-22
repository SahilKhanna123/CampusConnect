import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({ token: z.string().min(1) });

// POST /api/family/invite/accept
// Body: { token: string }
// Parents can now fully self-signup independently (see
// src/app/(auth)/sign-up/page.tsx), so this route doesn't create an
// account -- the caller must already be authenticated, and their signed-in
// email must exactly match ParentStudentInvite.parentEmail (proven via
// their own Supabase signup/login, the same standard the OTP path uses to
// prove student-email access). Creates ParentStudentLink at status=approved
// directly, not otp_verified -- the inviting student's own action is
// already unambiguous consent in this direction, asymmetric from the
// parent-initiated OTP flow (see the security note on ParentStudentLink in
// prisma/schema.prisma).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const invite = await prisma.parentStudentInvite.findUnique({
    where: { token: parsed.data.token },
    include: { student: { include: { studentRecord: { include: { universityDomain: true } } } } },
  });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: "This invite has already been used or is no longer valid." },
      { status: 400 },
    );
  }
  if (invite.expiresAt < new Date()) {
    await prisma.parentStudentInvite.update({
      where: { id: invite.id },
      data: { status: "expired" },
    });
    return NextResponse.json(
      { error: "This invite has expired. Ask them to send a new one." },
      { status: 400 },
    );
  }
  if (user.email.toLowerCase() !== invite.parentEmail) {
    return NextResponse.json(
      {
        error: `This invite was sent to ${invite.parentEmail}. Log in or sign up with that exact email to accept it.`,
      },
      { status: 403 },
    );
  }

  // The inviting student already has a StudentRecord by construction --
  // POST /api/family/invite requires isUniversityVerified, which only ever
  // succeeds together with claimOrCreateStudentRecord having already run
  // (see src/lib/onboarding.ts's syncUserFromAuth) -- but guard defensively
  // rather than assume, since this route only trusts what it can look up.
  const studentRecord = invite.student.studentRecord;
  if (!studentRecord) {
    return NextResponse.json(
      { error: "This invite can't be accepted right now. Contact support." },
      { status: 400 },
    );
  }

  // A previously-revoked link must not silently re-establish via this
  // route either -- same guard as the OTP confirm path, for the same
  // reason: a revocation is meant to be a real stop, not a snooze.
  const existingLink = await prisma.parentStudentLink.findUnique({
    where: {
      parentId_studentRecordId: { parentId: user.id, studentRecordId: studentRecord.id },
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

  await prisma.parentStudentLink.upsert({
    where: {
      parentId_studentRecordId: { parentId: user.id, studentRecordId: studentRecord.id },
    },
    update: { status: "approved", approvedAt: new Date() },
    create: {
      parentId: user.id,
      studentRecordId: studentRecord.id,
      status: "approved",
      approvedAt: new Date(),
    },
  });

  await prisma.parentStudentInvite.update({
    where: { id: invite.id },
    data: { status: "accepted" },
  });

  // Same badge grant as the OTP confirm path -- a parent is never expected
  // to have their own university email verified, so successfully linking
  // to a student (either direction) is its own independent verification
  // fact about this account.
  await prisma.verificationRecord.upsert({
    where: { userId_type: { userId: user.id, type: "parent_relationship" } },
    update: {
      status: "verified",
      verifiedAt: new Date(),
      metadata: { university: studentRecord.universityDomain.universityName },
    },
    create: {
      userId: user.id,
      type: "parent_relationship",
      status: "verified",
      verifiedAt: new Date(),
      metadata: { university: studentRecord.universityDomain.universityName },
    },
  });

  // Same denormalized app_metadata flag the OTP confirm path sets -- see
  // its comment for why this is best-effort and Prisma stays the real
  // source of truth.
  try {
    const admin = createAdminClient();
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { hasLinkedStudent: true },
    });
  } catch (err) {
    console.error("Failed to set hasLinkedStudent app_metadata:", err);
  }

  await createNotification({
    userId: invite.studentId,
    type: "family_invite_accepted",
    title: "Parent connection accepted",
    message: `${user.name} accepted your invitation and is now connected as your parent/guardian.`,
    relatedId: invite.id,
  });

  return NextResponse.json({ ok: true });
}
