import { RequestStatus, TripStatus } from "@prisma/client";

// Derives a display-only "expired" state for a past-due Trip/Request,
// computed at read time rather than stored -- same pattern as
// getPrimaryRouteLabel() in geo.ts. A Trip/Request whose date has passed
// without ever reaching a terminal status (completed/cancelled/declined)
// reads as "expired" here; the underlying DB status column is untouched,
// since "completed" specifically means the trip/request was matched and
// finished (it's what gates Review creation) and reusing it just because
// a date passed would be wrong for something that was never matched.
export function tripDisplayStatus(trip: {
  status: TripStatus;
  departureDate: Date;
}): TripStatus | "expired" {
  if (trip.status === "upcoming" && trip.departureDate < new Date()) {
    return "expired";
  }
  return trip.status;
}

export function requestDisplayStatus(request: {
  status: RequestStatus;
  neededDate: Date | null;
}): RequestStatus | "expired" {
  const isTerminal =
    request.status === "completed" ||
    request.status === "cancelled" ||
    request.status === "declined";
  if (
    !isTerminal &&
    request.neededDate !== null &&
    request.neededDate < new Date()
  ) {
    return "expired";
  }
  return request.status;
}
