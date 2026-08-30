import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { canCreatePost } from "@/lib/rate-limit";
import { tripFieldsSchema } from "@/lib/postSchemas";

// GET /api/trips?originCityId=&destinationCityId=&date=
// Filtered browse of active Trips -- no matching/discovery UI consumes this
// yet (deliberately deferred), but the endpoint itself is trivial and
// matches the shape the original TODO comment described. Requires auth
// (401 otherwise) and applies the same studentsOnly filter Explore/Home
// use -- this endpoint previously had no auth check and no studentsOnly
// filter at all, letting an unauthenticated caller bulk-enumerate every
// upcoming trip in the database, students-only ones included.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const originCityId = searchParams.get("originCityId") ?? undefined;
  const destinationCityId = searchParams.get("destinationCityId") ?? undefined;
  const date = searchParams.get("date");
  const studentsOnlyFilter = hasStudentRecord(user) ? {} : { studentsOnly: false };

  const trips = await prisma.trip.findMany({
    where: {
      status: "upcoming",
      ...studentsOnlyFilter,
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

  if (data.studentsOnly && !hasStudentRecord(user)) {
    return NextResponse.json(
      { error: "Only students can create a students-only post." },
      { status: 403 },
    );
  }

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
      studentsOnly: data.studentsOnly ?? false,
    },
  });

  return NextResponse.json({ ok: true, tripId: trip.id }, { status: 201 });
}
