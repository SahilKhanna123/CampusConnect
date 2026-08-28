import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/conversations/:id/archive
// Sets the caller's own ConversationParticipant.archivedAt = now() -- a
// per-user view preference (hides from the default /messages list, still
// reachable via ?tab=archived), never affects the other participant's own
// view. Same updateMany-against-(conversationId,userId)-as-authz idiom as
// POST /api/conversations/[id]/read -- 0 rows affected (not a participant)
// reports 404, not a distinguishable 403.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.conversationParticipant.updateMany({
    where: { conversationId: id, userId: user.id },
    data: { archivedAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
