import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { canCreatePost } from "@/lib/rate-limit";
import { requestFieldsSchema } from "@/lib/postSchemas";

// GET /api/requests?originCityId=&destinationCityId=&type=
// Filtered browse of standalone (tripId=null), still-pending Requests -- no
// matching/discovery UI consumes this yet (deliberately deferred). Requires
// auth (401 otherwise) and applies the same studentsOnly filter Explore/Home
// use -- this endpoint previously had no auth check and no studentsOnly
// filter at all, letting an unauthenticated caller bulk-enumerate every
// pending request in the database, students-only ones included.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const originCityId = searchParams.get("originCityId") ?? undefined;
  const destinationCityId = searchParams.get("destinationCityId") ?? undefined;
  const type = searchParams.get("type");
  const studentsOnlyFilter = hasStudentRecord(user) ? {} : { studentsOnly: false };

  const requests = await prisma.request.findMany({
    where: {
      tripId: null,
      status: "pending",
      ...studentsOnlyFilter,
      ...(originCityId ? { originCityId } : {}),
      ...(destinationCityId ? { destinationCityId } : {}),
      ...(type === "ride" || type === "package" ? { type } : {}),
    },
    include: {
      originCity: true,
      destinationCity: true,
      postedBy: { select: { id: true, name: true, photoUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

// POST /api/requests
// Body: requestFieldsSchema. beneficiaryId always equals the caller for
// now -- posting on behalf of a linked student is NOT wired up here.
// Request.beneficiaryId is a User FK, but a parent's linked student may
// have no User account at all (StudentRecord can be unclaimed); how to
// reconcile that is an explicitly open fork (see the Parent/Student Linking
// section of CLAUDE.md and the ParentStudentLink comment in
// prisma/schema.prisma) -- not something to silently resolve here.
// University verification is NOT enforced here yet, deliberately deferred.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request details." },
      { status: 400 },
    );
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

  const created = await prisma.request.create({
    data: {
      type: data.type,
      originCityId: data.originCityId,
      destinationCityId: data.destinationCityId ?? null,
      destinationText: data.destinationText ?? null,
      neededDate: data.neededDate ? new Date(data.neededDate) : null,
      neededTime: data.neededTime || null,
      flexibleTime: data.flexibleTime ?? false,
      seatsRequested: data.type === "ride" ? (data.seatsRequested ?? 1) : null,
      packageDescription:
        data.type === "package" ? data.packageDescription || null : null,
      packageSize: data.type === "package" ? data.packageSize || null : null,
      notes: data.notes || null,
      studentsOnly: data.studentsOnly ?? false,
      postedById: user.id,
      beneficiaryId: user.id,
    },
  });

  return NextResponse.json({ ok: true, requestId: created.id }, { status: 201 });
}
