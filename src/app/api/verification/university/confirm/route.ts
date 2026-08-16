import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ token: z.string().min(1) });

// POST /api/verification/university/confirm
// Body: { token: string }
// Single-use: the token is cleared on success so the same link can't be
// replayed. No auth check needed beyond the token itself — it's what proves
// the request — but the record's userId ties the resulting badge to the
// right account regardless of who's clicking.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const { token } = parsed.data;

  const record = await prisma.verificationRecord.findUnique({
    where: { token },
  });

  if (!record || record.type !== "university") {
    return NextResponse.json(
      { error: "Invalid or already-used verification link." },
      { status: 400 },
    );
  }

  if (record.status === "verified") {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  if (!record.tokenExpiresAt || record.tokenExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "This verification link has expired. Request a new one." },
      { status: 400 },
    );
  }

  await prisma.verificationRecord.update({
    where: { id: record.id },
    data: {
      status: "verified",
      verifiedAt: new Date(),
      token: null,
      tokenExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
