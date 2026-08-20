import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canCreatePost } from "@/lib/rate-limit";
import { tripFieldsSchema } from "@/lib/postSchemas";

// GET /api/trips?originCityId=&destinationCityId=&date=
// Filtered browse of active Trips -- no matching/discovery UI consumes this
// yet (deliberately deferred), but the endpoint itself is trivial and
// matches the shape the original TODO comment described.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const originCityId = searchParams.get("originCityId") ?? undefined;
  const destinationCityId = searchParams.get("destinationCityId") ?? undefined;
  const date = searchParams.get("date");

  const trips = await prisma.trip.findMany({
    where: {
      status: "upcoming",
      ...(originCityId ? { originCityId } : {}),
      ...(destinationCityId ? { destinationCityId } : {}),
      ...(date ? { departureDate: new Date(date) } : {}),
    },
    include: {
      originCity: true,
      destinationCity: true,
      traveler: { select: { id: true, name: true, photoUrl: true } },
    },
    orderBy: { departureDate: "asc" },
  });

  return NextResponse.json({ trips });
}

// POST /api/trips
// Body: tripFieldsSchema. seatsRemaining always starts equal to seatsTotal
// -- nothing can have booked a seat before the Trip exists. University
// verification is NOT enforced here yet -- deliberately deferred alongside
// the equivalent signup-domain restriction, see project notes.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = tripFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid trip details." }, { status: 400 });
  }
  const data = parsed.data;

  if (!(await canCreatePost(user.id))) {
    return NextResponse.json(
      { error: "You've reached the posting limit for now. Try again later." },
      { status: 429 },
    );
  }

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

  const trip = await prisma.trip.create({
    data: {
      travelerId: user.id,
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

  return NextResponse.json({ ok: true, tripId: trip.id }, { status: 201 });
}
