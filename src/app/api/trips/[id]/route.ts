import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { tripFieldsSchema } from "@/lib/postSchemas";
import { createNotification } from "@/lib/notifications";
import { getConfirmedRiderCounts } from "@/lib/tripParticipants";

// GET /api/trips/:id
// Requires auth (401 otherwise) and applies the same studentsOnly gate the
// page route (/trips/[id]) already enforces -- this endpoint previously had
// no auth check at all and leaked full trip data, including studentsOnly
// posts, to unauthenticated callers who knew or guessed an id. See the
// "One rider, at most one confirmed seat" precedent for reusing
// hasStudentRecord() rather than inventing a new check here.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      traveler: { select: { id: true, name: true, photoUrl: true } },
    },
  });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (trip.studentsOnly && trip.travelerId !== user.id && !hasStudentRecord(user)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ trip });
}

// PATCH /api/trips/:id
// Body: tripFieldsSchema (same shape as create -- the edit form always
// submits the full set, mirroring PATCH /api/profile's convention). Caller
// must be the Trip's own traveler; there is no separate "manager" role.
// Changing seatsTotal resets seatsRemaining to (new seatsTotal - confirmed
// participant count), not blindly to seatsTotal -- once Trip Participants
// (see CLAUDE.md) can hold a confirmed seat via
// ConnectionRequest.seatConfirmedAt, silently overwriting seatsRemaining
// would desync it from who's actually confirmed to ride. Reducing seatsTotal
// below the number of already-confirmed riders is rejected outright (400)
// rather than silently clamped, since there's no correct number to fall
// back to -- the owner has to release a seat first. Only reachable while
// the trip is still "upcoming" -- editing a completed or cancelled trip's details
// after the fact has no clear product reason (nothing reads those fields
// differently once terminal) and would risk silently rewriting history
// underneath any connections/history tied to it, so it's blocked
// server-side, not just hidden in the UI (see Edit's isUpcoming guard on
// the detail page).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (trip.travelerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (trip.status !== "upcoming") {
    return NextResponse.json(
      { error: "This trip can no longer be edited." },
      { status: 400 },
    );
  }

  const parsed = tripFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trip details." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.studentsOnly && !hasStudentRecord(user)) {
    return NextResponse.json(
      { error: "Only students can mark a post students-only." },
      { status: 403 },
    );
  }

  const [originCity, destinationCity] = await Promise.all([
    prisma.city.findUnique({ where: { id: data.originCityId } }),
    data.destinationCityId
      ? prisma.city.findUnique({ where: { id: data.destinationCityId } })
      : null,
  ]);
  if (!originCity || (data.destinationCityId && !destinationCity)) {
    return NextResponse.json(
      { error: "Invalid origin or destination city." },
      { status: 400 },
    );
  }

  // Confirmed ConnectionRequest riders + accepted SeatOffers -- see
  // getConfirmedRiderCounts (src/lib/tripParticipants.ts), the shared
  // "who's riding" count also used by /explore, Home, and the public
  // Participants roster on /trips/[id].
  const totalConsumed = (await getConfirmedRiderCounts([id])).get(id) ?? 0;
  if (data.seatsTotal < totalConsumed) {
    return NextResponse.json(
      {
        error: `Can't reduce seats below the ${totalConsumed} seat${totalConsumed === 1 ? "" : "s"} already spoken for by confirmed riders and accepted seat offers. Release one first.`,
      },
      { status: 400 },
    );
  }

  await prisma.trip.update({
    where: { id },
    data: {
      title: data.title,
      category: data.category,
      originCityId: data.originCityId,
      destinationCityId: data.destinationCityId ?? null,
      destinationText: data.destinationText ?? null,
      departureDate: new Date(data.departureDate),
      departureTime: data.departureTime || null,
      flexibleTime: data.flexibleTime ?? false,
      seatsTotal: data.seatsTotal,
      seatsRemaining: data.seatsTotal - totalConsumed,
      estimatedFarePerSeat:
        data.category === "uber_share" ? (data.estimatedFarePerSeat ?? null) : null,
      meetingPoint: data.category === "uber_share" ? data.meetingPoint || null : null,
      tripNotes: data.tripNotes || null,
      studentsOnly: data.studentsOnly ?? false,
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/trips/:id
// A soft delete (status -> cancelled), not a row removal -- consistent
// with how every other lifecycle in this schema works via a status enum,
// never a hard delete, and avoids FK issues once Conversation/Request rows
// can reference a Trip. Caller must be the Trip's own traveler, and only
// reachable from "upcoming" -- there's no un-cancelling, and an
// already-completed trip shouldn't be cancellable after the fact.
//
// Cancelling also resolves every ConnectionRequest tied to this trip that
// was still actionable:
//   - pending ones flip to "cancelled" (reusing the existing status value a
//     requester's own /cancel already produces -- from the requester's side
//     "my request is cancelled" is accurate regardless of who triggered it,
//     and the notification below explains why)
//   - accepted ones are left untouched -- the Conversation stays fully
//     intact and browsable, per product decision (don't delete historical
//     connection data); the notification just lets the other party know
//     the trip itself fell through
// Both groups get a trip_cancelled notification via the one notification
// path (see src/lib/notifications.ts). Pending/accepted SeatOffers (see
// Seat Offers) get the exact same pending-cancelled/accepted-untouched
// treatment, with their own distinct NotificationType. The affected-rows
// reads happen BEFORE the transaction so the notification loops below still
// have each row's pre-update status (pending vs. accepted) to pick the
// right wording.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (trip.travelerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (trip.status !== "upcoming") {
    return NextResponse.json(
      { error: "This trip can't be cancelled." },
      { status: 400 },
    );
  }

  const affectedRequests = await prisma.connectionRequest.findMany({
    where: { tripId: id, status: { in: ["pending", "accepted"] } },
    select: { id: true, requesterId: true, status: true },
  });
  // SeatOffers (see the Seat Offers section of CLAUDE.md) get the same
  // pending-flips-to-cancelled / accepted-stays-untouched-but-notified
  // treatment as ConnectionRequest above.
  const affectedSeatOffers = await prisma.seatOffer.findMany({
    where: { tripId: id, status: { in: ["pending", "accepted"] } },
    select: { id: true, recipientId: true, conversationId: true, status: true },
  });

  await prisma.$transaction([
    prisma.trip.update({ where: { id }, data: { status: "cancelled" } }),
    prisma.connectionRequest.updateMany({
      where: { tripId: id, status: "pending" },
      data: { status: "cancelled" },
    }),
    prisma.seatOffer.updateMany({
      where: { tripId: id, status: "pending" },
      data: { status: "cancelled", respondedAt: new Date() },
    }),
  ]);

  const tripLabel = trip.title ? ` "${trip.title}"` : "";
  await Promise.all(
    affectedRequests.map((r) =>
      createNotification({
        userId: r.requesterId,
        type: "trip_cancelled",
        title: "Trip cancelled",
        message:
          r.status === "pending"
            ? `${user.name} cancelled the trip${tripLabel}. Your connection request has been cancelled.`
            : `${user.name} cancelled the trip${tripLabel} you were connected on. Your conversation is still available.`,
        relatedId: r.id,
      }),
    ),
  );

  await Promise.all(
    affectedSeatOffers.map((s) =>
      createNotification({
        userId: s.recipientId,
        type: "seat_offer_trip_cancelled",
        title: "Trip cancelled",
        message:
          s.status === "pending"
            ? `${user.name} cancelled the trip${tripLabel}. Your seat request has been cancelled.`
            : `${user.name} cancelled the trip${tripLabel} you had a confirmed seat on.`,
        relatedId: s.conversationId,
      }),
    ),
  );

  return NextResponse.json({ ok: true });
}
