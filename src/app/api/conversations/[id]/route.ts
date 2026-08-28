import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// GET /api/conversations/:id
// Returns the conversation with its Trip and both participants -- used by
// /messages/[id] for the thread header. 404s (not 403) when the caller
// isn't a participant, so a conversation's existence isn't leaked to
// someone outside it.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      trip: { include: { originCity: true, destinationCity: true } },
      participants: {
        include: { user: { select: { id: true, name: true, photoUrl: true } } },
      },
    },
  });
  const isParticipant = conversation?.participants.some(
    (p) => p.userId === user.id,
  );
  if (!conversation || !isParticipant) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

// DELETE /api/conversations/:id
// Sets the caller's own ConversationParticipant.deletedAt = now() -- hides
// this conversation from their /messages list entirely (both the default
// and ?tab=archived views). Deliberately NOT a hard delete of the
// Conversation/Message rows, and doesn't touch the other participant's own
// view at all: a Conversation is jointly owned by both participants, so
// one person hiding it shouldn't destroy the other's history, same
// "don't delete shared history" precedent as Trip cancellation leaving
// ConnectionRequest/Conversation rows untouched. Automatically cleared the
// next time either party sends a new Message here (see POST
// /api/conversations/[id]/messages), so a deleted thread resurfaces on new
// activity rather than silently going unnoticed -- there's no separate
// "trash" view to check for it otherwise. Same updateMany-as-authz idiom
// as the other /api/conversations/[id]* routes.
export async function DELETE(
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
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
