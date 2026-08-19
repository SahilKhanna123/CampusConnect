import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/connection-requests/:id/cancel
// Caller must be the request's requesterId (the opposite ownership check
// from accept/decline, which require recipientId). Only a pending request
// can be cancelled.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const connectionRequest = await prisma.connectionRequest.findUnique({
    where: { id },
  });
  if (!connectionRequest) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (connectionRequest.requesterId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (connectionRequest.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been resolved." },
      { status: 400 },
    );
  }

  await prisma.connectionRequest.update({
    where: { id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
