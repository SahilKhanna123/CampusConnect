import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification, truncateForNotification } from "@/lib/notifications";

const createSchema = z.object({
  requestId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// POST /api/reviews
// Body: { requestId, rating (1-5), comment? }
// A completed Request has exactly two participants: whoever posted it
// (postedById) and the Trip that fulfilled it (Trip.travelerId, via
// Request.tripId) -- each can independently review the other, enforced by
// @@unique([requestId, reviewerId]) allowing up to two Review rows per
// Request, one per direction. Because a Request can only reach
// accepted/completed through POST /api/requests/[id]/accept (which always
// sets tripId in the same write as the status change), a completed Request
// is guaranteed to have tripId set -- no defensive null-handling needed.
// revieweeId is always derived server-side from the caller's role, never
// trusted from the body, same non-spoofable pattern as
// POST /api/connection-requests.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A request and a 1-5 rating are required." },
      { status: 400 },
    );
  }
  const { requestId, rating, comment } = parsed.data;

  const found = await prisma.request.findUnique({
    where: { id: requestId },
    include: { trip: true },
  });
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.status !== "completed") {
    return NextResponse.json(
      { error: "This request isn't completed yet." },
      { status: 400 },
    );
  }

  const isPoster = found.postedById === user.id;
  const isTripOwner = found.tripId !== null && found.trip?.travelerId === user.id;
  if (!isPoster && !isTripOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const revieweeId = isPoster ? found.trip!.travelerId : found.postedById;
  if (revieweeId === user.id) {
    return NextResponse.json(
      { error: "You can't review yourself." },
      { status: 400 },
    );
  }

  const existing = await prisma.review.findUnique({
    where: { requestId_reviewerId: { requestId, reviewerId: user.id } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You've already reviewed this." },
      { status: 409 },
    );
  }

  const created = await prisma.review.create({
    data: { requestId, reviewerId: user.id, revieweeId, rating, comment: comment || null },
  });

  await createNotification({
    userId: revieweeId,
    type: "review_received",
    title: "You got a new review",
    message: `${user.name} left you a ${rating}-star review${comment ? `: "${truncateForNotification(comment)}"` : "."}`,
    relatedId: found.id,
  });

  return NextResponse.json({ ok: true, reviewId: created.id }, { status: 201 });
}
