import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/conversations/:id/read
// Marks the caller's ConversationParticipant.lastReadAt = now() for this
// conversation -- called by MessageThread on mount and after each poll that
// brings in new messages, so the unread bold/badge treatment (see
// /messages and the nav "Messages" item, both via src/lib/messaging.ts)
// clears once the thread has actually been opened. updateMany against the
// (conversationId, userId) pair doubles as the authorization check: a
// caller who isn't a participant matches zero rows, which we report as 404,
// not as a distinguishable 403 -- same "don't leak conversation existence"
// reasoning as the other /api/conversations/[id]* routes.
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
    data: { lastReadAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
