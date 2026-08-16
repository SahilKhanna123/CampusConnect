import { NextResponse } from "next/server";

// GET /api/trips/:id
// TODO: fetch one Trip with traveler, origin/destination City, and open Requests.
export async function GET() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
