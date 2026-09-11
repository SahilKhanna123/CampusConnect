import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { packagePostFieldsSchema } from "@/lib/postSchemas";

// GET /api/package-posts/:id
// Requires auth (401 otherwise) and applies the same studentsOnly gate the
// page route (/package-posts/[id]) already enforces -- same pattern as
// GET /api/trips/:id and GET /api/requests/:id.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const found = await prisma.packagePost.findUnique({
    where: { id },
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      postedBy: { select: { id: true, name: true, photoUrl: true } },
    },
  });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.studentsOnly && found.postedById !== user.id && !hasStudentRecord(user)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ packagePost: found });
}

// PATCH /api/package-posts/:id
// Body: packagePostFieldsSchema (same shape as create). Caller must be the
// post's own poster. Only reachable while status is "open" -- same
// reasoning as Trip's own edit gate (no clear product reason to edit a
// completed/cancelled post's details after the fact).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const found = await prisma.packagePost.findUnique({ where: { id } });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.postedById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (found.status !== "open") {
    return NextResponse.json(
      { error: "This post can no longer be edited." },
      { status: 400 },
    );
  }

  const parsed = packagePostFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post details." }, { status: 400 });
  }
  const data = parsed.data;

  if (data.studentsOnly && !hasStudentRecord(user)) {
    return NextResponse.json(
      { error: "Only students can mark a post students-only." },
      { status: 403 },
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

  await prisma.packagePost.update({
    where: { id },
    data: {
      kind: data.kind,
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

  return NextResponse.json({ ok: true });
}

// DELETE /api/package-posts/:id
// A soft delete (status -> cancelled), not a row removal -- same reasoning
// as DELETE /api/trips/:id. Caller must be the post's own poster, and only
// reachable from "open" -- there's no un-cancelling.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const found = await prisma.packagePost.findUnique({ where: { id } });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.postedById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (found.status !== "open") {
    return NextResponse.json(
      { error: "This post can't be cancelled." },
      { status: 400 },
    );
  }

  await prisma.packagePost.update({
    where: { id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
