import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/family/link-objection/:token/reject
// Deliberately public/no-auth -- the whole point of the objection link is
// that a student who never signed up can still shut down an unwanted
// connection. Deliberately a POST, not a GET, and only ever called from an
// explicit button click on /family/link-objection (never auto-fired on
// page load) -- email security scanners are known to pre-fetch links
// (confirmed firsthand in this project), and a GET that auto-revokes would
// let a scanner falsely reject a legitimate connection.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const link = await prisma.parentStudentLink.findUnique({
    where: { objectionToken: token },
  });

  if (!link) {
    return NextResponse.json(
      { error: "This link is invalid or has already been used." },
      { status: 400 },
    );
  }

  await prisma.parentStudentLink.update({
    where: { id: link.id },
    data: { status: "revoked", revokedAt: new Date(), objectionToken: null },
  });

  // If that was this parent's only non-revoked link, clear the edge-readable
  // app_metadata flag src/middleware.ts checks -- otherwise a parent who
  // loses their sole link this way would keep bypassing the gate. Prisma's
  // ParentStudentLink rows remain the real source of truth (see
  // hasLinkedStudent in src/lib/auth.ts); best-effort, same as setting the
  // flag in the confirm route.
  const remaining = await prisma.parentStudentLink.count({
    where: { parentId: link.parentId, status: { not: "revoked" } },
  });
  if (remaining === 0) {
    try {
      const admin = createAdminClient();
      await admin.auth.admin.updateUserById(link.parentId, {
        app_metadata: { hasLinkedStudent: false },
      });
    } catch (err) {
      console.error("Failed to clear hasLinkedStudent app_metadata:", err);
    }

    // Same reasoning: if this was the parent's last non-revoked link, their
    // "✓ Verified Parent of <University> Student" badge (see
    // parent-link/confirm/route.ts) is no longer true either.
    await prisma.verificationRecord.updateMany({
      where: { userId: link.parentId, type: "parent_relationship" },
      data: { status: "revoked" },
    });

    // And the self-declared, publicly-shown linkedStudentName (see
    // prisma/schema.prisma) loses its only backing connection -- clear it
    // rather than leave a student's name publicly displayed with nothing
    // behind it. Only cleared when NO non-revoked link remains at all: if
    // the parent still has another linked student, the free-text name might
    // describe that student instead, and there's no way to tell which part
    // of it to remove, so it's left for the parent to update themselves.
    await prisma.user.update({
      where: { id: link.parentId },
      data: { linkedStudentName: null },
    });
  }

  return NextResponse.json({ ok: true });
}
