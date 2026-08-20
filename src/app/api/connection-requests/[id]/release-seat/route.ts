import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/connection-requests/:id/release-seat
// Caller must be the request's recipientId (the trip owner). Undoes a
// confirm-seat mistake -- clears seatConfirmedAt and gives the seat back to
// Trip.seatsRemaining, in one transaction. Deliberately available regardless
// of the trip's current status (upcoming/completed/cancelled): this is a
// correction of the owner's own bookkeeping, not a new user-facing action
// that needs to respect the "is this trip still actionable" gate everything
// else uses. No notification is sent -- unlike confirm-seat, this isn't an
// event worth telling the rider about on its own (the same product judgment
// as "Mark Completed" not touching ConnectionRequest at all).
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
  });
  if (!connectionRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (connectionRequest.recipientId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!connectionRequest.seatConfirmedAt) {
    return NextResponse.json(
      { error: "This person doesn't have a confirmed seat." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    const cleared = await tx.connectionRequest.updateMany({
      where: { id, seatConfirmedAt: { not: null } },
      data: { seatConfirmedAt: null },
    });
    if (cleared.count === 0) {
      throw new Error("ALREADY_RELEASED");
    }
    await tx.trip.update({
      where: { id: connectionRequest.tripId },
      data: { seatsRemaining: { increment: 1 } },
    });
  }).catch((err) => {
    if (err instanceof Error && err.message === "ALREADY_RELEASED") return;
    throw err;
  });

  return NextResponse.json({ ok: true });
}
