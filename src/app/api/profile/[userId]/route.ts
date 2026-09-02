import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile } from "@/lib/profile";
import { getProfileStats } from "@/lib/reviews";

// GET /api/profile/[userId]
// Public profile fields (see src/lib/profile.ts's getPublicProfile for the
// exact allowlist -- no email, no StudentRecord/ParentStudentLink data) plus
// a `stats` block (average rating, completed trip/request counts) from
// src/lib/reviews.ts's getProfileStats -- computed on read, not stored.
// Requires the caller to be logged in: per product decision, CampusConnect
// profiles are visible to the trusted community, not to the open internet.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  const [profile, stats] = await Promise.all([
    getPublicProfile(userId),
    getProfileStats(userId),
  ]);
  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ...profile, stats });
}
