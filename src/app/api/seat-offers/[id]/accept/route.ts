import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";
import { createNotification } from "@/lib/notifications";
import { hasConfirmedSeatOnTrip } from "@/lib/tripParticipants";

// POST /api/seat-offers/:id/accept
// Caller must be the offer's recipientId (403 otherwise). Accepting IS the
// seat confirmation here -- unlike ConnectionRequest (accept, then a
// separate owner "Add as Participant" step via confirm-seat), a SeatOffer
// already represents the owner's specific commitment of one seat, so
// accept atomically decrements Trip.seatsRemaining in the same transaction
// as the status flip -- same guarded-updateMany-as-concurrency-guard idiom
// as confirm-seat.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const offer = await prisma.seatOffer.findUnique({
    where: { id },
    include: { trip: true },
  });
  if (!offer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (offer.recipientId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (offer.status !== "pending") {
    return NextResponse.json(
      { error: "This seat request has already been resolved." },
      { status: 400 },
    );
  }
  if (tripDisplayStatus(offer.trip) !== "upcoming") {
    return NextResponse.json(
      { error: "This trip is no longer active." },
      { status: 400 },
    );
  }
  // Same duplicate-seat guard confirm-seat uses -- covers the case where
  // this recipient already holds a confirmed seat on this trip via an
  // accepted ConnectionRequest (or, in principle, another SeatOffer, though
  // a duplicate pending offer to the same recipient is already blocked at
  // creation).
  if (await hasConfirmedSeatOnTrip(offer.tripId, offer.recipientId)) {
    return NextResponse.json(
      { error: "You already have a confirmed seat on this trip." },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const decremented = await tx.trip.updateMany({
        where: { id: offer.tripId, seatsRemaining: { gt: 0 } },
        data: { seatsRemaining: { decrement: 1 } },
      });
      if (decremented.count === 0) {
        throw new Error("NO_CAPACITY");
      }
      const resolved = await tx.seatOffer.updateMany({
        where: { id, status: "pending" },
        data: { status: "accepted", respondedAt: new Date(), seatConfirmedAt: new Date() },
      });
      if (resolved.count === 0) {
        throw new Error("ALREADY_RESOLVED");
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_CAPACITY") {
      return NextResponse.json(
        { error: "No seats remaining on this trip." },
        { status: 400 },
      );
    }
    if (err instanceof Error && err.message === "ALREADY_RESOLVED") {
      return NextResponse.json(
        { error: "This seat request has already been resolved." },
        { status: 400 },
      );
    }
    throw err;
  }

  await createNotification({
    userId: offer.trip.travelerId,
    type: "seat_offer_accepted",
    title: "Seat request accepted",
    message: `${user.name} accepted your seat request${offer.trip.title ? ` for "${offer.trip.title}"` : ""}.`,
    relatedId: offer.tripId,
  });

  return NextResponse.json({ ok: true });
}
