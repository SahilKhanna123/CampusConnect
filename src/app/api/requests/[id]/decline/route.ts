import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const declineSchema = z.object({ tripId: z.string().min(1) });

// POST /api/requests/:id/decline
// Body: { tripId }
// Same caller-identification approach as accept (a Trip owner, proven via
// tripId, since a standalone Request has no traveler of its own yet) --
// but deliberately does NOT attach tripId or touch any capacity, per
// accept's comment. No UI button calls this today: Request is a single row,
// not per-viewer like ConnectionRequest, so any one traveler declining would
// end the request's life for every other traveler who might still want to
// fulfill it -- exposing this to random viewers would be an easy way to
// grief someone else's open request. Kept here for spec-completeness and
// the future "request created directly against one specific trip" case,
// where declining really would only concern that one trip's owner.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = declineSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A trip is required." }, { status: 400 });
  }
  const { tripId } = parsed.data;

  const { id } = await params;
  const found = await prisma.request.findUnique({ where: { id } });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  if (trip.travelerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (found.postedById === user.id) {
    return NextResponse.json(
      { error: "You can't decline your own request." },
      { status: 400 },
    );
  }
  if (found.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been resolved." },
      { status: 400 },
    );
  }

  const resolved = await prisma.request.updateMany({
    where: { id, status: "pending" },
    data: { status: "declined", respondedAt: new Date() },
  });
  if (resolved.count === 0) {
    return NextResponse.json(
      { error: "This request has already been resolved." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
