import { NextResponse } from "next/server";

// GET /api/trips?originCityId=&destinationCityId=&date=&seats=&packageSpace=
// TODO: search/filter active Trips; default to the caller's featured
// RouteCommunity when no filters are given, per Home vs. Explore behavior.
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

// POST /api/trips
// Body: { originCityId, destinationCityId, departureDate, departureTime?,
//          seatsTotal, packageSpaceAvailable, packageCapacityNote?, tripNotes? }
// TODO: check canCreatePost(userId) from src/lib/rate-limit.ts before insert;
// seatsRemaining starts equal to seatsTotal.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
