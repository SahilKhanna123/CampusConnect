import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// POST /api/connection-requests/:id/decline
// Caller must be the request's recipientId. Only a pending request can be
// declined. Declining never touches Conversation -- no connection is
// created, per spec.
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

  await prisma.connectionRequest.update({
    where: { id },
    data: { status: "declined" },
  });

  await createNotification({
    userId: connectionRequest.requesterId,
    type: "connection_declined",
    title: "Connection request declined",
    message: `${user.name} declined your connection request${connectionRequest.trip.title ? ` for "${connectionRequest.trip.title}"` : ""}.`,
    relatedId: connectionRequest.id,
  });

  return NextResponse.json({ ok: true });
}
