import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";
import { findOrCreateConversationForPost } from "@/lib/messaging";
import { createNotification, truncateForNotification } from "@/lib/notifications";
import { isBlockedBetween } from "@/lib/blocks";
import { canSendMessage } from "@/lib/rate-limit";

// GET /api/conversations
// Lists the caller's conversations, most recently created first, each with
// its Trip or PackagePost route, the other participant, and a one-message
// preview -- what /messages renders. A conversation is scoped to exactly
// one of trip/packagePost, never both -- see the schema comment on
// Conversation.packagePostId.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      trip: { include: { originCity: true, destinationCity: true } },
      packagePost: { include: { originCity: true, destinationCity: true } },
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
  tripId: z.string().min(1).optional(),
  packagePostId: z.string().min(1).optional(),
  body: z.string().trim().min(1).max(2000),
});

// POST /api/conversations
// Body: { tripId, body } | { packagePostId, body }
// Starts (or reuses) a conversation between the caller and the Trip's
// traveler (both personal_car and uber_share categories -- Uber-sharing is
// just a Trip category, not a separate model) or a PackagePost's poster,
// with `body` as the first Message -- the plan doc's "message before
// committing to a formal request" flow. Triggered by "Register for a seat"
// on /trips/[id] for a Trip, or PackageMessageForm for a PackagePost --
// deliberately the *only* interaction entry point for a package post, per
// product decision ("all conversations about packages should be done in
// private DMs"). Deliberately does NOT create a Request or touch
// Trip.seatsRemaining -- that's the separate matching lifecycle
// (requests/[id]/accept, see CLAUDE.md).
//
// Conversation find-or-create is shared with POST
// /api/connection-requests/[id]/accept via findOrCreateConversationForPost
// (src/lib/messaging.ts) -- see that function's comment for why it's a
// plain find-then-create rather than a race-hardened pattern.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = startConversationSchema.safeParse(await request.json());
  if (!parsed.success || (!parsed.data.tripId && !parsed.data.packagePostId)) {
    return NextResponse.json({ error: "A message is required." }, { status: 400 });
  }
  const { tripId, packagePostId, body } = parsed.data;

  if (!(await canSendMessage(user.id))) {
    return NextResponse.json(
      { error: "You're sending messages too quickly. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let counterpartId: string;
  let notificationTitle: string;

  if (tripId) {
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
    // Same studentsOnly gate POST /api/connection-requests enforces -- closes
    // the direct-endpoint gap for a non-student who can't discover or open
    // this trip's page in the first place.
    if (trip.studentsOnly && !hasStudentRecord(user)) {
      return NextResponse.json(
        { error: "This trip is only visible to students." },
        { status: 403 },
      );
    }
    if (await isBlockedBetween(user.id, trip.travelerId)) {
      return NextResponse.json(
        { error: "You can't message this user." },
        { status: 403 },
      );
    }
    counterpartId = trip.travelerId;
    notificationTitle = trip.title ? ` for "${trip.title}"` : "";
  } else {
    const packagePost = await prisma.packagePost.findUnique({
      where: { id: packagePostId },
    });
    if (!packagePost) {
      return NextResponse.json({ error: "Package post not found." }, { status: 404 });
    }
    if (packagePost.postedById === user.id) {
      return NextResponse.json(
        { error: "You can't message yourself about your own post." },
        { status: 400 },
      );
    }
    if (packagePost.status !== "open") {
      return NextResponse.json(
        { error: "This package post is no longer open." },
        { status: 400 },
      );
    }
    if (packagePost.studentsOnly && !hasStudentRecord(user)) {
      return NextResponse.json(
        { error: "This post is only visible to students." },
        { status: 403 },
      );
    }
    if (await isBlockedBetween(user.id, packagePost.postedById)) {
      return NextResponse.json(
        { error: "You can't message this user." },
        { status: 403 },
      );
    }
    counterpartId = packagePost.postedById;
    notificationTitle = "";
  }

  const conversation = await findOrCreateConversationForPost(
    tripId ? { tripId } : { packagePostId: packagePostId! },
    user.id,
    counterpartId,
  );

  await prisma.message.create({
    data: { conversationId: conversation.id, senderId: user.id, body },
  });

  await createNotification({
    userId: counterpartId,
    type: "new_message",
    title: "New message",
    message: `${user.name}: ${truncateForNotification(body)}${notificationTitle}`,
    relatedId: conversation.id,
  });

  return NextResponse.json(
    { ok: true, conversationId: conversation.id },
    { status: 201 },
  );
}
