import { TripStatus } from "@prisma/client";

// Derives a display-only "expired" state for a past-due Trip, computed at
// read time rather than stored -- same pattern as getPrimaryRouteLabel() in
// geo.ts. A Trip whose date has passed without ever reaching a terminal
// status (completed/cancelled) reads as "expired" here; the underlying DB
// status column is untouched.
export function tripDisplayStatus(trip: {
  status: TripStatus;
  departureDate: Date;
}): TripStatus | "expired" {
  if (trip.status === "upcoming" && trip.departureDate < new Date()) {
    return "expired";
  }
  return trip.status;
}
