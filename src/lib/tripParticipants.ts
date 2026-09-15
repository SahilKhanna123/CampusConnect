import { prisma } from "@/lib/prisma";

/**
 * Whether a given user already holds a confirmed seat on a trip, via
 * EITHER mechanism that can grant one -- an accepted ConnectionRequest the
 * owner has confirmed (POST .../connection-requests/[id]/confirm-seat) or
 * an accepted SeatOffer (POST .../seat-offers/[id]/accept, which confirms
 * in the same step). Used as a guard at every point that would otherwise
 * let the same person end up holding two seats on one trip: the owner
 * confirming a second accepted ConnectionRequest from someone already
 * riding, the owner sending a fresh SeatOffer to someone already riding,
 * or that recipient accepting it. A plain pre-check, not wrapped in a
 * serializable transaction -- same "not worth race-hardening beyond the
 * existing guarded-decrement idiom" calibration already used for duplicate
 * pending-request checks elsewhere in this app; the actual seatsRemaining
 * capacity guard (guarded updateMany inside $transaction, unaffected by
 * this check) still guarantees the trip itself is never oversold even in
 * the rare case this check loses a race.
 */
export async function hasConfirmedSeatOnTrip(
  tripId: string,
  userId: string,
): Promise<boolean> {
  const [connection, seatOffer] = await Promise.all([
    prisma.connectionRequest.findFirst({
      where: { tripId, requesterId: userId, seatConfirmedAt: { not: null } },
      select: { id: true },
    }),
    prisma.seatOffer.findFirst({
      where: { tripId, recipientId: userId, seatConfirmedAt: { not: null } },
      select: { id: true },
    }),
  ]);
  return !!connection || !!seatOffer;
}

/**
 * Confirmed-rider count per trip, batched across many trips at once (avoids
 * N+1 -- used by /explore and Home's per-card counts). Combines both
 * mechanisms that can hold a seat: ConnectionRequest.seatConfirmedAt and
 * SeatOffer.seatConfirmedAt (see the Trip Participants and Seat Offers
 * sections of CLAUDE.md) -- the public "who's riding" concept the
 * Participants roster already represents.
 */
export async function getConfirmedRiderCounts(
  tripIds: string[],
): Promise<Map<string, number>> {
  if (tripIds.length === 0) return new Map();

  const [connectionCounts, seatOfferCounts] = await Promise.all([
    prisma.connectionRequest.groupBy({
      by: ["tripId"],
      where: { tripId: { in: tripIds }, seatConfirmedAt: { not: null } },
      _count: true,
    }),
    prisma.seatOffer.groupBy({
      by: ["tripId"],
      where: { tripId: { in: tripIds }, seatConfirmedAt: { not: null } },
      _count: true,
    }),
  ]);

  const counts = new Map<string, number>();
  for (const c of connectionCounts) {
    counts.set(c.tripId, (counts.get(c.tripId) ?? 0) + c._count);
  }
  for (const c of seatOfferCounts) {
    counts.set(c.tripId, (counts.get(c.tripId) ?? 0) + c._count);
  }
  return counts;
}
