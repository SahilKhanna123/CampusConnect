import { NextResponse } from "next/server";

// POST /api/requests/:id/accept
// Caller must be the Trip's traveler (or, for a standalone request, the
// traveler offering to fulfill it — attaches tripId as part of accepting).
// TODO: run capacity check + decrement (Trip.seatsRemaining) and status
// transition inside a single DB transaction to prevent overbooking races.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
