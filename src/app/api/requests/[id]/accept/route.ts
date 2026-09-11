import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";
import { createNotification } from "@/lib/notifications";

const acceptSchema = z.object({ tripId: z.string().min(1) });

// POST /api/requests/:id/accept
// Body: { tripId }
// A standalone Request (tripId=null, "requester posts first") gets matched
// when a Trip owner offers to fulfill it -- caller must be that Trip's own
// travelerId, proven by looking up the given tripId rather than trusting
// anything on Request itself, since a standalone Request has no traveler to
// check ownership against yet. Draws from the exact same Trip.seatsRemaining
// pool ConnectionRequest's confirm-seat/release-seat routes use, so the
// capacity check + write happens inside the same kind of guarded
// $transaction (0-rows-affected-as-concurrency-guard) those routes already
// established -- this is what prevents overbooking relative to both
// mechanisms at once. Unlike confirm-seat (always exactly 1 seat), a
// standalone Request can ask for more than one (seatsRequested), so the
// guard/decrement amount is request-specific, not a flat 1. Both remaining
// categories (personal_car, uber_share) use this same numeric seat pool --
// package requests moved out entirely to the standalone PackagePost model,
// which has no "match to a trip" concept at all, so the old boolean
// packageSpaceAvailable branch this route used to have doesn't apply
// anymore.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = acceptSchema.safeParse(await request.json());
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
      { error: "You can't fulfill your own request." },
      { status: 400 },
    );
  }
  // A studentsOnly Request is invisible to a non-student on /requests/[id]
  // (404, same idiom as the equivalent Trip gate) -- closes the same gap
  // for a non-student fulfilling it directly through this endpoint.
  if (found.studentsOnly && !hasStudentRecord(user)) {
    return NextResponse.json(
      { error: "This request is only visible to students." },
      { status: 403 },
    );
  }
  if (found.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been resolved." },
      { status: 400 },
    );
  }
  if (tripDisplayStatus(trip) !== "upcoming") {
    return NextResponse.json(
      { error: "This trip is no longer active." },
      { status: 400 },
    );
  }
  if (found.category !== trip.category) {
    return NextResponse.json(
      { error: "This trip doesn't match what you're requesting." },
      { status: 400 },
    );
  }

  const seatsNeeded = found.seatsRequested ?? 1;
  if (trip.seatsRemaining < seatsNeeded) {
    return NextResponse.json(
      { error: "Not enough seats remaining on this trip." },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const resolved = await tx.request.updateMany({
        where: { id, status: "pending" },
        data: { tripId, status: "accepted", respondedAt: new Date() },
      });
      if (resolved.count === 0) {
        throw new Error("ALREADY_RESOLVED");
      }
      const decremented = await tx.trip.updateMany({
        where: { id: tripId, seatsRemaining: { gte: seatsNeeded } },
        data: { seatsRemaining: { decrement: seatsNeeded } },
      });
      if (decremented.count === 0) {
        throw new Error("NO_CAPACITY");
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_RESOLVED") {
      return NextResponse.json(
        { error: "This request has already been resolved." },
        { status: 400 },
      );
    }
    if (err instanceof Error && err.message === "NO_CAPACITY") {
      return NextResponse.json(
        { error: "Not enough seats remaining on this trip." },
        { status: 400 },
      );
    }
    throw err;
  }

  await createNotification({
    userId: found.postedById,
    type: "request_accepted",
    title: "Your request was accepted",
    message: `${user.name} is fulfilling your request${trip.title ? ` with "${trip.title}"` : ""}.`,
    relatedId: found.id,
  });

  return NextResponse.json({ ok: true });
}
