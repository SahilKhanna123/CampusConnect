import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/notifications/:id/read
// Marks one of the caller's own notifications read. The updateMany on
// (id, userId) doubles as its own authorization check -- 0 rows updated
// means either the notification doesn't exist or it belongs to someone
// else, and both cases return the same 404 rather than leaking which,
// same pattern as POST /api/conversations/[id]/read.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
