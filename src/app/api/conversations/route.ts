import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";
import { findOrCreateConversationForTrip } from "@/lib/messaging";
import { createNotification, truncateForNotification } from "@/lib/notifications";
import { isBlockedBetween } from "@/lib/blocks";

// GET /api/conversations
// Lists the caller's conversations, most recently created first, each with
// its Trip route, the other participant, and a one-message preview -- what
// /messages renders.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      trip: { include: { originCity: true, destinationCity: true } },
      participants: {
        where: { userId: { not: user.id } },
        include: { user: { select: { id: true, name: true, photoUrl: true } } },
      },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ conversations });
}

const startConversationSchema = z.object({
  tripId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
});

// POST /api/conversations
// Body: { tripId, body }
// Starts (or reuses) a conversation between the caller and the Trip's
// traveler, with `body` as the first Message -- the plan doc's "message the
// traveler before committing to a formal request" flow (Conversation is
// scoped to trip+counterpart, requestId stays null). Triggered today by the
// "Register for a seat" button on /trips/[id]. Deliberately does NOT create
// a Request or touch Trip.seatsRemaining -- that's the separate, still-
// unbuilt matching lifecycle (requests/[id]/accept, see CLAUDE.md), which
// needs a DB-transaction capacity check this endpoint has no business doing.
//
// Conversation find-or-create is shared with POST
// /api/connection-requests/[id]/accept via findOrCreateConversationForTrip
// (src/lib/messaging.ts) -- see that function's comment for why it's a
// plain find-then-create rather than a race-hardened pattern.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = startConversationSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }
  const { tripId, body } = parsed.data;

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  if (trip.travelerId === user.id) {
    return NextResponse.json(
      { error: "You can't message yourself about your own trip." },
      { status: 400 },
    );
  }
  if (tripDisplayStatus(trip) !== "upcoming") {
    return NextResponse.json(
      { error: "This trip is no longer accepting messages." },
      { status: 400 },
    );
  }
  // Neither party can start a new conversation with the other once blocked,
  // regardless of who initiated the block (plan doc §7) -- an existing
  // conversation that predates the block is untouched (this endpoint only
  // finds-or-creates; it never reaches an already-existing thread).
  if (await isBlockedBetween(user.id, trip.travelerId)) {
    return NextResponse.json(
      { error: "You can't message this user." },
      { status: 403 },
    );
  }

  const conversation = await findOrCreateConversationForTrip(
    tripId,
    user.id,
    trip.travelerId,
  );

  await prisma.message.create({
    data: { conversationId: conversation.id, senderId: user.id, body },
  });

  await createNotification({
    userId: trip.travelerId,
    type: "new_message",
    title: "New message",
    message: `${user.name}: ${truncateForNotification(body)}`,
    relatedId: conversation.id,
  });

  return NextResponse.json(
    { ok: true, conversationId: conversation.id },
    { status: 201 },
  );
}
