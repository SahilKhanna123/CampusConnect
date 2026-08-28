import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/conversations/:id/unarchive
// Clears the caller's own ConversationParticipant.archivedAt -- the
// inverse of .../archive, same updateMany-as-authz idiom.
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
    data: { archivedAt: null },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
