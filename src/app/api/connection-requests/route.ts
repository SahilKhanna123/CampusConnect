import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";
import { createNotification, truncateForNotification } from "@/lib/notifications";

const createSchema = z.object({
  tripId: z.string().min(1),
  // Optional context the requester can attach for the trip owner -- see
  // the schema comment on ConnectionRequest.message. Never required: the
  // plain one-click "Request to Connect" flow (message omitted) must keep
  // working exactly as it did before this field existed.
  message: z.string().trim().max(500).optional(),
});

// POST /api/connection-requests
// Body: { tripId, message? }
// Creates a pending ConnectionRequest from the caller to the Trip's
// traveler -- requesterId/recipientId are always derived server-side
// (requesterId = the authenticated caller, recipientId = trip.travelerId),
// never taken from the request body, so there's no way to file a request
// "as" someone else or against a recipient other than the trip's actual
// owner. Rejects requesting your own trip, requesting a non-active trip
// (same tripDisplayStatus gate as POST /api/conversations, for consistency
// between the two "contact the owner" entry points), and a duplicate
// PENDING request -- an already-declined or -cancelled request doesn't
// block a fresh attempt, only a live pending one does.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A trip is required." }, { status: 400 });
  }
  const { tripId, message } = parsed.data;

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  if (trip.travelerId === user.id) {
    return NextResponse.json(
      { error: "You can't request to connect on your own trip." },
      { status: 400 },
    );
  }
  if (tripDisplayStatus(trip) !== "upcoming") {
    return NextResponse.json(
      { error: "This trip is no longer accepting connection requests." },
      { status: 400 },
    );
  }

  const existingPending = await prisma.connectionRequest.findFirst({
    where: { tripId, requesterId: user.id, status: "pending" },
  });
  if (existingPending) {
    return NextResponse.json(
      { error: "You already have a pending request for this trip." },
      { status: 409 },
    );
  }

  const created = await prisma.connectionRequest.create({
    data: {
      tripId,
      requesterId: user.id,
      recipientId: trip.travelerId,
      status: "pending",
      message: message || null,
    },
  });

  await createNotification({
    userId: trip.travelerId,
    type: "connection_request",
    title: "New connection request",
    message: `${user.name} wants to connect about your trip${trip.title ? ` "${trip.title}"` : ""}.${message ? ` "${truncateForNotification(message)}"` : ""}`,
    relatedId: created.id,
  });

  return NextResponse.json(
    { ok: true, connectionRequestId: created.id, status: created.status },
    { status: 201 },
  );
}
