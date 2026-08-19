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
