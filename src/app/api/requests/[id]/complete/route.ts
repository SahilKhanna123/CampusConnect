import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/requests/:id/complete
// Callable by either participant: the Request's own poster, or (once
// tripId is attached by accept) that Trip's own traveler -- matches the
// plan doc's "either party marks it" lifecycle rule. No capacity change
// (the seat/package space stays consumed permanently, same as Trip's own
// Mark Completed not returning anything) and no notification -- matches the
// existing MarkTripCompleteButton precedent that an owner/participant's own
// completion action isn't itself an event worth notifying the other side
// about. Deliberately not date-gated, same trust-the-marking-party
// precedent as Trip's own Mark Completed.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const found = await prisma.request.findUnique({
    where: { id },
    include: { trip: true },
  });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPoster = found.postedById === user.id;
  const isTripOwner = found.tripId !== null && found.trip?.travelerId === user.id;
  if (!isPoster && !isTripOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (found.status !== "accepted") {
    return NextResponse.json(
      { error: "This request isn't accepted yet." },
      { status: 400 },
    );
  }

  const resolved = await prisma.request.updateMany({
    where: { id, status: "accepted" },
    data: { status: "completed", completedAt: new Date() },
  });
  if (resolved.count === 0) {
    return NextResponse.json(
      { error: "This request isn't accepted yet." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
