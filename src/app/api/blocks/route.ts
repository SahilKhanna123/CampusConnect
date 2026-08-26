import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const createSchema = z.object({ blockedId: z.string().min(1) });

// POST /api/blocks
// Body: { blockedId }
// Creates a Block(blockerId=caller, blockedId) -- blockerId is always
// derived from the authenticated caller, never trusted from the body, same
// non-spoofable pattern as POST /api/reports/POST /api/connection-requests.
// Rejects a self-block with 400 (matching the "can't target your own X"
// convention already used for self-reports/self-connection-requests, not
// 403 -- this codebase reserves 403 for "wrong caller against someone
// else's resource") and a nonexistent blockedId with 404. A duplicate block
// (already blocked) is a no-op success via upsert rather than a 409 -- there
// is no "try blocking again" flow worth protecting the way ConnectionRequest
// protects its pending-duplicate check, so silently succeeding is simpler
// than surfacing a race as an error.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { blockedId } = parsed.data;

  if (blockedId === user.id) {
    return NextResponse.json(
      { error: "You can't block yourself." },
      { status: 400 },
    );
  }

  const blockedUser = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!blockedUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: user.id, blockedId } },
    create: { blockerId: user.id, blockedId },
    update: {},
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
