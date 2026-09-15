import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { canCreatePost } from "@/lib/rate-limit";
import { packagePostFieldsSchema } from "@/lib/postSchemas";

// GET /api/package-posts?originCityId=&destinationCityId=
// Filtered browse of still-open PackagePosts. Requires auth (401 otherwise)
// and applies the same studentsOnly filter Explore/Home use, same pattern
// as GET /api/trips.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const originCityId = searchParams.get("originCityId") ?? undefined;
  const destinationCityId = searchParams.get("destinationCityId") ?? undefined;
  const studentsOnlyFilter = hasStudentRecord(user) ? {} : { studentsOnly: false };

  const packagePosts = await prisma.packagePost.findMany({
    where: {
      status: "open",
      ...studentsOnlyFilter,
      ...(originCityId ? { originCityId } : {}),
      ...(destinationCityId ? { destinationCityId } : {}),
    },
    include: {
      originCity: true,
      destinationCity: true,
      postedBy: { select: { id: true, name: true, photoUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ packagePosts });
}

// POST /api/package-posts
// Body: packagePostFieldsSchema. Deliberately minimal -- no seats/capacity,
// no formal accept handshake (see the model comment in prisma/schema.prisma
// -- all real coordination happens over DM via PackageMessageForm).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = packagePostFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post details." }, { status: 400 });
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

  const created = await prisma.packagePost.create({
    data: {
      postedById: user.id,
      originCityId: data.originCityId,
      destinationCityId: data.destinationCityId ?? null,
      destinationText: data.destinationText ?? null,
      date: data.date ? new Date(data.date) : null,
      time: data.time || null,
      flexibleTime: data.flexibleTime ?? false,
      notes: data.notes || null,
      studentsOnly: data.studentsOnly ?? false,
    },
  });

  return NextResponse.json(
    { ok: true, packagePostId: created.id },
    { status: 201 },
  );
}
