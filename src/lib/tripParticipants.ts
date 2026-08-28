import { prisma } from "@/lib/prisma";

/**
 * Confirmed-rider count per trip, batched across many trips at once (avoids
 * N+1 -- used by /explore and Home's per-card counts). Combines both
 * mechanisms that can hold a seat: ConnectionRequest.seatConfirmedAt and
 * SeatOffer.seatConfirmedAt (see the Trip Participants and Seat Offers
 * sections of CLAUDE.md) -- deliberately does NOT include standalone
 * Requests matched via POST /api/requests/[id]/accept, a separate
 * mechanism with its own "Requests You're Fulfilling" section that stays
 * owner-only; this helper is specifically about the public "who's riding"
 * concept the Participants roster already represents.
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
