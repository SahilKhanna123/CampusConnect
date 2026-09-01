import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Kept intentionally small and fixed, even though Report.reason is a plain
// String column with no DB enum -- free-form nuance belongs in the optional
// `detail` field instead. A fixed vocabulary is what keeps a future
// moderation queue scannable/filterable without a migration.
const REPORT_REASONS = [
  "spam",
  "harassment",
  "unsafe_behavior",
  "scam_or_fraud",
  "inappropriate_content",
  "other",
] as const;

const createSchema = z
  .object({
    reportedUserId: z.string().min(1),
    reason: z.enum(REPORT_REASONS),
    detail: z.string().trim().max(1000).optional(),
    contextType: z.enum(["trip", "request", "message", "profile"]).optional(),
    contextId: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      v.contextType === "profile"
        ? true
        : !!v.contextType === !!v.contextId,
    {
      message: "contextType and contextId must be provided together.",
    },
  );

// POST /api/reports
// Body: { reportedUserId, reason, detail?, contextType?, contextId? }
// Creates a Report(status=open) for manual/admin review -- there is no
// admin/moderator concept or moderation queue UI anywhere in this app yet,
// so this route has no automated consequence of any kind: no suspension,
// no notification, no email. A Report row is reviewed by direct DB/Prisma
// Studio access only, per the plan doc's Flow F ("manual review for MVP").
// reporterId is always derived from the authenticated caller, never trusted
// from the body, same non-spoofable pattern as POST /api/connection-requests.
// contextId is deliberately never validated against the underlying
// Trip/Request/Message -- those rows can legitimately be cancelled/deleted
// later and a report should still stand as history, and validating three
// different entity types for what's currently just free-text context for a
// moderator who doesn't exist yet isn't worth it.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  }
  const { reportedUserId, reason, detail, contextType, contextId } = parsed.data;

  if (reportedUserId === user.id) {
    return NextResponse.json(
      { error: "You can't report yourself." },
      { status: 400 },
    );
  }

  const reportedUser = await prisma.user.findUnique({
    where: { id: reportedUserId },
  });
  if (!reportedUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const created = await prisma.report.create({
    data: {
      reporterId: user.id,
      reportedUserId,
      contextType: contextType ?? null,
      contextId: contextId ?? null,
      reason,
      detail: detail || null,
      status: "open",
    },
  });

  return NextResponse.json({ ok: true, reportId: created.id }, { status: 201 });
}
