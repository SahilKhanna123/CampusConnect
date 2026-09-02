import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile } from "@/lib/profile";
import { getProfileStats } from "@/lib/reviews";
import { lookingForLabel } from "@/lib/lookingFor";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";

// Public profile view of another user -- only the fields getPublicProfile
// (src/lib/profile.ts) allowlists: name, photo, university, general home
// area, verification badges. Requires the viewer to be logged in, per
// product decision (not a fully public/unauthenticated directory).
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/login");

  const { userId } = await params;
  const [profile, stats] = await Promise.all([
    getPublicProfile(userId),
    getProfileStats(userId),
  ]);
  if (!profile) notFound();

  const initialBlocked =
    viewer.id !== userId ? await isBlockedBetween(viewer.id, userId) : false;

  return (
    <div>
      {profile.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.photoUrl}
          alt=""
          width={96}
          height={96}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
      )}
      <h1>{profile.name}</h1>
      {profile.university && <p>{profile.university}</p>}
      {(profile.major || profile.year) && (
        <p>
          {[profile.major, profile.year].filter(Boolean).join(" · ")}
        </p>
      )}
      {profile.homeArea && <p>{profile.homeArea}</p>}
      {profile.linkedStudentName && (
        <p>Connected to {profile.linkedStudentName}</p>
      )}
      {profile.travelPreferences && <p>{profile.travelPreferences}</p>}
      {profile.lookingFor.length > 0 && (
        <p>
          Looking for:{" "}
          {profile.lookingFor.map(lookingForLabel).join(", ")}
        </p>
      )}
      <p>
        {stats.reviewCount > 0
          ? `${stats.averageRating!.toFixed(1)}/5 (${stats.reviewCount} review${stats.reviewCount === 1 ? "" : "s"})`
          : "No reviews yet"}
      </p>
      <p>
        {stats.completedTripCount} completed trip
        {stats.completedTripCount === 1 ? "" : "s"} ·{" "}
        {stats.completedRequestCount} completed request
        {stats.completedRequestCount === 1 ? "" : "s"}
      </p>
      <ul>
        {profile.badges.email && <li>✓ Email Verified</li>}
        {profile.badges.university && <li>✓ University Verified</li>}
        {profile.badges.parentRelationship && (
          <li>✓ Parent Relationship Verified</li>
        )}
        {profile.badges.identity && <li>✓ Identity Verified</li>}
      </ul>
      {viewer.id !== userId && (
        <>
          <ReportButton reportedUserId={userId} contextType="profile" />{" "}
          <BlockButton blockedUserId={userId} initialBlocked={initialBlocked} />
        </>
      )}
    </div>
  );
}
