import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// POST /api/package-posts/:id/complete
// Owner-only, only reachable from "open" -- mirrors POST /api/trips/:id/
// complete's shape exactly. No capacity to release (there was never any),
// no notification -- same product judgment as Trip's own Mark Completed
// not being an event worth notifying anyone else about.
export async function POST(
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
      { error: "This post can't be marked completed." },
      { status: 400 },
    );
  }

  await prisma.packagePost.update({
    where: { id },
    data: { status: "completed", completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
