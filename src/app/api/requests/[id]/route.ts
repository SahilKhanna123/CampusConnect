import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { requestFieldsSchema } from "@/lib/postSchemas";

// GET /api/requests/:id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const found = await prisma.request.findUnique({
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
  return NextResponse.json({ request: found });
}

// PATCH /api/requests/:id
// Body: requestFieldsSchema (same shape as create -- the edit form always
// submits the full set). Caller must be the Request's own poster
// (postedById), not necessarily its beneficiary -- there is no on-behalf-of
// posting wired up yet (see the POST handler in ../route.ts), so today
// these are always the same person anyway.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const found = await prisma.request.findUnique({ where: { id } });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.postedById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = requestFieldsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request details." },
      { status: 400 },
    );
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

  await prisma.request.update({
    where: { id },
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
    },
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/requests/:id
// A soft delete (status -> cancelled), not a row removal -- same reasoning
// as DELETE /api/trips/:id. Caller must be the Request's own poster.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const found = await prisma.request.findUnique({ where: { id } });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.postedById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.request.update({
    where: { id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
