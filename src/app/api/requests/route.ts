import { NextResponse } from "next/server";

// GET /api/requests?originCityId=&destinationCityId=&neededDate=&type=
// TODO: search standalone (tripId=null) Requests, e.g. for a traveler
// browsing unmet needs on their route.
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

// POST /api/requests
// Body: { type: 'ride' | 'package', tripId?, beneficiaryId?, ...type-specific fields }
// If tripId is omitted this is a standalone "need" post (Request.tripId stays
// null) — supports the requester-posts-first flow. beneficiaryId defaults to
// the caller; a parent may only set beneficiaryId to a linked, approved student.
// TODO: check canCreatePost(userId) from src/lib/rate-limit.ts before insert.
export async function POST() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
