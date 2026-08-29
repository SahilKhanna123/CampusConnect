import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";
import { isBlockedBetween } from "@/lib/blocks";
import { createNotification } from "@/lib/notifications";
import { hasConfirmedSeatOnTrip } from "@/lib/tripParticipants";

const createSchema = z.object({ conversationId: z.string().min(1) });

// POST /api/seat-offers
// Body: { conversationId }
// The owner-initiated counterpart to POST /api/connection-requests --
// always sent from within an existing Conversation about the caller's own
// Trip (see the SeatOffer schema comment). recipientId is derived from the
// conversation's own participants, never trusted from the body: the other
// participant besides the caller. Rejects a non-owner caller, a
// non-upcoming trip, no seats remaining, a block between the two parties
// (same check POST /api/conversations and POST /api/connection-requests
// already use), and a duplicate PENDING offer to the same recipient on the
// same trip -- same "only a pending duplicate blocks a fresh attempt"
// convention as ConnectionRequest.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A conversation is required." }, { status: 400 });
  }
  const { conversationId } = parsed.data;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { trip: true, participants: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (conversation.trip.travelerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const recipientId = conversation.participants.find(
    (p) => p.userId !== user.id,
  )?.userId;
  if (!recipientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (tripDisplayStatus(conversation.trip) !== "upcoming") {
    return NextResponse.json(
      { error: "This trip is no longer active." },
      { status: 400 },
    );
  }
  if (conversation.trip.seatsRemaining <= 0) {
    return NextResponse.json(
      { error: "No seats remaining on this trip." },
      { status: 400 },
    );
  }
  if (await isBlockedBetween(user.id, recipientId)) {
    return NextResponse.json(
      { error: "You can't send a seat request to this user." },
      { status: 403 },
    );
  }

  const existingPending = await prisma.seatOffer.findFirst({
    where: { tripId: conversation.trip.id, recipientId, status: "pending" },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a pending seat request for this rider." },
      { status: 409 },
    );
  }
  // Early feedback so the owner doesn't send a redundant offer to someone
  // already confirmed via the other mechanism (an accepted+confirmed
  // ConnectionRequest) -- the real enforcement is the matching check at
  // accept time (POST .../seat-offers/[id]/accept), since this recipient
  // could still become confirmed elsewhere between now and then.
  if (await hasConfirmedSeatOnTrip(conversation.trip.id, recipientId)) {
    return NextResponse.json(
      { error: "This rider already has a confirmed seat on this trip." },
      { status: 400 },
    );
  }

  const created = await prisma.seatOffer.create({
    data: {
      tripId: conversation.trip.id,
      recipientId,
      conversationId,
      status: "pending",
    },
  });

  await createNotification({
    userId: recipientId,
    type: "seat_offer_received",
    title: "You have a seat request",
    message: `${user.name} offered you a seat${conversation.trip.title ? ` on "${conversation.trip.title}"` : " on their trip"}.`,
    relatedId: conversationId,
  });

  return NextResponse.json({ ok: true, seatOfferId: created.id }, { status: 201 });
}
