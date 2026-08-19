import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";

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
// Conversation reuse below is a plain find-then-create, not the
// race-hardened pattern claimOrCreateStudentRecord uses for StudentRecord --
// a duplicate thread here is a minor UX nuisance (two tabs for the same
// trip), not a security or data-integrity issue, so that extra rigor isn't
// worth it here.
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
  if (tripDisplayStatus(trip) !== "active") {
    return NextResponse.json(
      { error: "This trip is no longer accepting messages." },
      { status: 400 },
    );
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      tripId,
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: trip.travelerId } } },
      ],
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        tripId,
        participants: {
          create: [{ userId: user.id }, { userId: trip.travelerId }],
        },
      },
    });
  }

  await prisma.message.create({
    data: { conversationId: conversation.id, senderId: user.id, body },
  });

  return NextResponse.json(
    { ok: true, conversationId: conversation.id },
    { status: 201 },
  );
}
