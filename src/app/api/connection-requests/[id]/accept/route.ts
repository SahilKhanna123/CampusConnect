import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { findOrCreateConversationForTrip } from "@/lib/messaging";
import { createNotification } from "@/lib/notifications";

// POST /api/connection-requests/:id/accept
// Caller must be the request's recipientId (the trip owner) -- 403 for
// anyone else, mirroring the ownership-check pattern PATCH/DELETE
// /api/trips/[id] already use (403, not 404, since Trip/Request/
// ConnectionRequest ownership checks in this app are consistently 403;
// 404-to-avoid-leaking-existence is reserved for the private Conversation
// thread routes, a different sensitivity tier). Only a pending request can
// be accepted. Accepting calls findOrCreateConversationForTrip
// (src/lib/messaging.ts) -- the same helper POST /api/conversations uses --
// so "a connection is created" means exactly "the existing Conversation
// system now has a thread for this pair," not a new mechanism.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const connectionRequest = await prisma.connectionRequest.findUnique({
    where: { id },
    include: { trip: true },
  });
  if (!connectionRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (connectionRequest.recipientId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (connectionRequest.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been resolved." },
      { status: 400 },
    );
  }

  const conversation = await findOrCreateConversationForTrip(
    connectionRequest.tripId,
    connectionRequest.requesterId,
    connectionRequest.recipientId,
  );

  await prisma.connectionRequest.update({
    where: { id },
    data: { status: "accepted" },
  });

  await createNotification({
    userId: connectionRequest.requesterId,
    type: "connection_accepted",
    title: "Connection request accepted",
    message: `${user.name} accepted your connection request${connectionRequest.trip.title ? ` for "${connectionRequest.trip.title}"` : ""}.`,
    relatedId: conversation.id,
  });

  return NextResponse.json({ ok: true, conversationId: conversation.id });
}
