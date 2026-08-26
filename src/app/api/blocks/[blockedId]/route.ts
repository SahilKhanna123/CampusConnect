import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// DELETE /api/blocks/:blockedId
// Removes the caller's own Block row against :blockedId (unblock).
// deleteMany scoped to (blockerId=caller, blockedId=param) doubles as its
// own authorization check -- 0 rows affected (no such block, or it belongs
// to someone else) returns 404, same "updateMany/deleteMany-as-authz" idiom
// already used by POST /api/conversations/[id]/read and POST
// /api/notifications/[id]/read.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ blockedId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { blockedId } = await params;
  const result = await prisma.block.deleteMany({
    where: { blockerId: user.id, blockedId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
