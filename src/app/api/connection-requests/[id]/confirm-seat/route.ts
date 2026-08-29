import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { tripDisplayStatus } from "@/lib/postStatus";
import { hasConfirmedSeatOnTrip } from "@/lib/tripParticipants";

// POST /api/connection-requests/:id/confirm-seat
// Caller must be the request's recipientId (the trip owner). Only an
// ACCEPTED connection can be confirmed for a seat -- this is the owner
// turning "we're in touch about this trip" into "this person is actually
// riding," not a replacement for the accept step. The capacity check and
// decrement run inside one interactive transaction: seatsRemaining is
// decremented via an updateMany guarded on `seatsRemaining: { gt: 0 }` (the
// same 0-rows-affected-as-guard idiom already used for the read-receipt
// routes), and if that affects zero rows -- someone else took the last seat
// in a concurrent request, or it was already zero -- the whole transaction
// throws and nothing is written, including the ConnectionRequest itself.
// This is the first real write path for Trip.seatsRemaining other than the
// create/edit "reset to seatsTotal" paths; see the Trip Participants
// section of CLAUDE.md.
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
  if (connectionRequest.status !== "accepted") {
    return NextResponse.json(
      { error: "Only an accepted connection can be confirmed for a seat." },
      { status: 400 },
    );
  }
  if (connectionRequest.seatConfirmedAt) {
    return NextResponse.json(
      { error: "This person is already confirmed for a seat." },
      { status: 400 },
    );
  }
  if (tripDisplayStatus(connectionRequest.trip) !== "upcoming") {
    return NextResponse.json(
      { error: "This trip is no longer active." },
      { status: 400 },
    );
  }
  // Guards against the same rider ending up with two seats on one trip --
  // e.g. a second accepted ConnectionRequest from someone already confirmed
  // via an earlier one, or already confirmed via a SeatOffer instead. See
  // hasConfirmedSeatOnTrip's own comment for the race-tolerance tradeoff.
  if (
    await hasConfirmedSeatOnTrip(connectionRequest.tripId, connectionRequest.requesterId)
  ) {
    return NextResponse.json(
      { error: "This person already has a confirmed seat on this trip." },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const decremented = await tx.trip.updateMany({
        where: { id: connectionRequest.tripId, seatsRemaining: { gt: 0 } },
        data: { seatsRemaining: { decrement: 1 } },
      });
      if (decremented.count === 0) {
        throw new Error("NO_SEATS_REMAINING");
      }
      await tx.connectionRequest.update({
        where: { id },
        data: { seatConfirmedAt: new Date() },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_SEATS_REMAINING") {
      return NextResponse.json(
        { error: "No seats remaining on this trip." },
        { status: 400 },
      );
    }
    throw err;
  }

  await createNotification({
    userId: connectionRequest.requesterId,
    type: "trip_seat_confirmed",
    title: "You have a confirmed seat",
    message: `${user.name} confirmed your seat${connectionRequest.trip.title ? ` on "${connectionRequest.trip.title}"` : " on the trip"}.`,
    relatedId: connectionRequest.tripId,
  });

  return NextResponse.json({ ok: true });
}
