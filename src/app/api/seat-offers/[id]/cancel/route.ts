import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/seat-offers/:id/cancel
// Caller must be the trip's own owner rescinding their own still-pending
// offer -- the inverse ownership check from accept/decline, same pattern
// as ConnectionRequest's requester-only cancel. No notification, matching
// ConnectionRequest cancel's own precedent (an own-action correction, not
// an event worth notifying the other side about).
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
  if (offer.status !== "pending") {
    return NextResponse.json(
      { error: "This seat request has already been resolved." },
      { status: 400 },
    );
  }

  const resolved = await prisma.seatOffer.updateMany({
    where: { id, status: "pending" },
    data: { status: "cancelled", respondedAt: new Date() },
  });
  if (resolved.count === 0) {
    return NextResponse.json(
      { error: "This seat request has already been resolved." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
