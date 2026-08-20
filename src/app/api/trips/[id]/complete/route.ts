import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/trips/:id/complete
// Owner-only, only reachable from "upcoming". A distinct, simpler thing
// from the still-unimplemented POST /api/requests/[id]/complete stub --
// that one is the Request/Trip MATCHING lifecycle's completion step (gated
// on both participants, unbuilt); this is just the trip owner declaring
// their own Trip done, no counterpart negotiation involved. Existing
// ConnectionRequest rows (pending or accepted) are left untouched -- unlike
// cancel, completing a trip doesn't invalidate anything, per product
// decision (see the Trip Management section of CLAUDE.md). A stale pending
// request against a completed trip simply can no longer be accepted --
// POST /api/connection-requests/[id]/accept re-checks the trip is still
// "upcoming" for exactly this reason.
export async function POST(
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
      { error: "This trip can't be marked completed." },
      { status: 400 },
    );
  }

  await prisma.trip.update({ where: { id }, data: { status: "completed" } });

  return NextResponse.json({ ok: true });
}
