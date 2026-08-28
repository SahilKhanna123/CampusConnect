import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/seat-offers/:id/release-seat
// Caller must be the trip's own owner. Undoes an accepted SeatOffer --
// clears seatConfirmedAt and gives the seat back to Trip.seatsRemaining, in
// one transaction. `status` stays "accepted" (historical record that the
// recipient did accept) -- mirrors ConnectionRequest's own release-seat
// exactly, including having no upcoming-only restriction (a correction of
// the owner's own bookkeeping, not a new user-facing action) and no
// notification.
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
  if (offer.trip.travelerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!offer.seatConfirmedAt) {
    return NextResponse.json(
      { error: "This rider isn't confirmed." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    const cleared = await tx.seatOffer.updateMany({
      where: { id, seatConfirmedAt: { not: null } },
      data: { seatConfirmedAt: null },
    });
    if (cleared.count === 0) {
      throw new Error("ALREADY_RELEASED");
    }
    await tx.trip.update({
      where: { id: offer.tripId },
      data: { seatsRemaining: { increment: 1 } },
    });
  }).catch((err) => {
    if (err instanceof Error && err.message === "ALREADY_RELEASED") return;
    throw err;
  });

  return NextResponse.json({ ok: true });
}
