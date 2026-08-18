import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tripFieldsSchema } from "@/lib/postSchemas";

// GET /api/trips/:id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  return NextResponse.json({ trip });
}

// PATCH /api/trips/:id
// Body: tripFieldsSchema (same shape as create -- the edit form always
// submits the full set, mirroring PATCH /api/profile's convention). Caller
// must be the Trip's own traveler; there is no separate "manager" role.
// Changing seatsTotal resets seatsRemaining to match it -- safe because
// nothing can have booked a seat yet (accept/decline is still a stub, i.e.
// matching is deliberately not built).
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

  const parsed = tripFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trip details." }, { status: 400 });
  }
  const data = parsed.data;

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

  await prisma.trip.update({
    where: { id },
    data: {
      title: data.title,
      originCityId: data.originCityId,
      destinationCityId: data.destinationCityId ?? null,
      destinationText: data.destinationText ?? null,
      departureDate: new Date(data.departureDate),
      departureTime: data.departureTime || null,
      flexibleTime: data.flexibleTime ?? false,
      seatsTotal: data.seatsTotal,
      seatsRemaining: data.seatsTotal,
      packageSpaceAvailable: data.packageSpaceAvailable ?? false,
      packageCapacityNote: data.packageCapacityNote || null,
      tripNotes: data.tripNotes || null,
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/trips/:id
// A soft delete (status -> cancelled), not a row removal -- consistent
// with how every other lifecycle in this schema works via a status enum,
// never a hard delete, and avoids FK issues once Conversation/Request rows
// can reference a Trip (accept/decline is still a stub, so none exist yet,
// but the pattern should hold once that's built). Caller must be the
// Trip's own traveler.
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

  await prisma.trip.update({ where: { id }, data: { status: "cancelled" } });

  return NextResponse.json({ ok: true });
}
