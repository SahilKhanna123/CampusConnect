import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendUniversityVerificationEmail } from "@/lib/email";

const bodySchema = z.object({ email: z.string().email() });
const TOKEN_TTL_HOURS = 48;

// POST /api/verification/university/request
// Body: { email: string }
// Caller must be authenticated. Checks the email's domain against
// SupportedUniversityDomain, then creates/refreshes a single-use, expiring
// VerificationRecord(type=university) and emails the confirmation link.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const { email } = parsed.data;

  const domain = email.split("@")[1]?.toLowerCase();
  const universityDomain = domain
    ? await prisma.supportedUniversityDomain.findUnique({ where: { domain } })
    : null;

  if (!universityDomain) {
    return NextResponse.json(
      { error: "This isn't a supported university email domain yet." },
      { status: 400 },
    );
  }

  const token = randomBytes(32).toString("hex");
  const tokenExpiresAt = new Date(
    Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000,
  );

  await prisma.verificationRecord.upsert({
    where: { userId_type: { userId: user.id, type: "university" } },
    update: {
      status: "pending",
      verifiedValue: email,
      token,
      tokenExpiresAt,
      verifiedAt: null,
      metadata: { university: universityDomain.universityName, domain },
    },
    create: {
      userId: user.id,
      type: "university",
      status: "pending",
      verifiedValue: email,
      token,
      tokenExpiresAt,
      metadata: { university: universityDomain.universityName, domain },
    },
  });

  const verifyUrl = `${new URL(request.url).origin}/verify?token=${token}`;
  try {
    await sendUniversityVerificationEmail({
      to: email,
      verifyUrl,
      universityName: universityDomain.universityName,
    });
  } catch {
    // The VerificationRecord above is still valid — the token just wasn't
    // emailed. Tell the caller explicitly rather than reporting success.
    return NextResponse.json(
      {
        error:
          "Couldn't send the verification email. Try again in a moment, or contact support if this keeps happening.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
