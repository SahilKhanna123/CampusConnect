import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from "@/lib/otp";
import { sendParentConnectionOtpEmail } from "@/lib/email";

const bodySchema = z.object({ studentEmail: z.string().email() });

// POST /api/family/parent-link/request
// Body: { studentEmail: string }
// Caller must be authenticated with their OWN email already verified --
// always a traceable, accountable adult identity behind every OTP sent to
// a third party's inbox. Rejects unsupported university domains up front
// (mirrors /api/verification/university/request) rather than creating any
// pending state for an address we can't validate. Does NOT touch
// StudentRecord at all yet -- that's only created at successful confirm
// (see .../confirm/route.ts), so a typo'd email here never leaves an
// orphan record behind.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownEmailVerified = user.verifications.some(
    (v) => v.type === "email" && v.status === "verified",
  );
  if (!ownEmailVerified) {
    return NextResponse.json(
      { error: "Verify your own email before connecting a student." },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const studentEmail = parsed.data.studentEmail.trim().toLowerCase();

  const domain = studentEmail.split("@")[1];
  const universityDomain = domain
    ? await prisma.supportedUniversityDomain.findUnique({ where: { domain } })
    : null;

  if (!universityDomain) {
    return NextResponse.json(
      {
        error:
          "This isn't a supported university email domain yet. Double-check the address, or contact support if you think this is a mistake.",
      },
      { status: 400 },
    );
  }

  const code = generateOtpCode();

  // A parent may retry with a corrected email, so this isn't an upsert on
  // studentEmail -- just append a fresh pending request. Old, unconsumed
  // requests for this parent are cleared so a stale code can't linger.
  await prisma.parentStudentOtpRequest.deleteMany({
    where: { parentId: user.id, studentEmail },
  });
  await prisma.parentStudentOtpRequest.create({
    data: {
      parentId: user.id,
      studentEmail,
      universityDomainId: universityDomain.id,
      otpCodeHash: hashOtpCode(code),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });

  try {
    await sendParentConnectionOtpEmail({
      to: studentEmail,
      parentName: user.name,
      otpCode: code,
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't send the verification email. Try again in a moment." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
