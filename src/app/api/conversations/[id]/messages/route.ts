import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification, truncateForNotification } from "@/lib/notifications";

// Shared by GET and POST below -- not exported (Next's route export
// validation rejects any named export from a route.ts that isn't a
// recognized HTTP method or route config key, same reason postSchemas.ts
// lives outside src/app/api/**). 404s (not 403) when the caller isn't a
// participant, so a conversation's existence isn't leaked to someone
// outside it.
async function requireParticipant(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  const isParticipant = conversation?.participants.some(
    (p) => p.userId === userId,
  );
  return conversation && isParticipant ? conversation : null;
}

// GET /api/conversations/:id/messages?since=
// Client polls this on an interval while a thread is open (see plan doc §14
// -- polling chosen over websockets for MVP). `since` (an ISO timestamp)
// returns only messages sent after it, for incremental fetch.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await requireParticipant(id, user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");
  const sinceDate = since ? new Date(since) : null;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      ...(sinceDate && !Number.isNaN(sinceDate.getTime())
        ? { sentAt: { gt: sinceDate } }
        : {}),
    },
    include: { sender: { select: { id: true, name: true, photoUrl: true } } },
    orderBy: { sentAt: "asc" },
  });

  return NextResponse.json({ messages });
}

const sendMessageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

// POST /api/conversations/:id/messages
// Body: { body: string }
// MVP is text-only; attachmentUrl/attachmentType columns exist for future use.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await requireParticipant(id, user.id);
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = sendMessageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: { conversationId: id, senderId: user.id, body: parsed.data.body },
    include: { sender: { select: { id: true, name: true, photoUrl: true } } },
  });

  // New activity resurfaces a conversation either party had deleted from
  // their own /messages list (see DELETE /api/conversations/[id]) --
  // there's no separate "trash" view to check for it otherwise, so a
  // deleted thread would otherwise silently miss a new message forever.
  // Deliberately does NOT clear archivedAt -- archiving is a sticky,
  // explicit preference the user has to undo themselves.
  await prisma.conversationParticipant.updateMany({
    where: { conversationId: id, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

  const recipients = conversation.participants.filter((p) => p.userId !== user.id);
  await Promise.all(
    recipients.map((p) =>
      createNotification({
        userId: p.userId,
        type: "new_message",
        title: "New message",
        message: `${user.name}: ${truncateForNotification(parsed.data.body)}`,
        relatedId: id,
      }),
    ),
  );

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
