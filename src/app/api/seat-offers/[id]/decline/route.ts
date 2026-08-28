import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// POST /api/seat-offers/:id/decline
// Caller must be the offer's recipientId. No capacity change (nothing was
// ever decremented for a still-pending offer).
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

  const resolved = await prisma.seatOffer.updateMany({
    where: { id, status: "pending" },
    data: { status: "declined", respondedAt: new Date() },
  });
  if (resolved.count === 0) {
    return NextResponse.json(
      { error: "This seat request has already been resolved." },
      { status: 400 },
    );
  }

  await createNotification({
    userId: offer.trip.travelerId,
    type: "seat_offer_declined",
    title: "Seat request declined",
    message: `${user.name} declined your seat request${offer.trip.title ? ` for "${offer.trip.title}"` : ""}.`,
    relatedId: offer.conversationId,
  });

  return NextResponse.json({ ok: true });
}
