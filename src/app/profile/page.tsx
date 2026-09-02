import { redirect } from "next/navigation";
import {
  getCurrentUser,
  universityBadgeLabel,
  parentRelationshipBadgeLabel,
  hasCompletedOnboarding,
} from "@/lib/auth";
import { getCitiesByRegion, getPrimaryRouteLabel } from "@/lib/geo";
import { getProfileStats } from "@/lib/reviews";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { BlockButton } from "@/components/BlockButton";
import { prisma } from "@/lib/prisma";

// Self profile view + edit. Name/photo/home-area are editable here (per
// "students should eventually be able to edit non-verification
// information"); university and verification badges are always read-only,
// derived from VerificationRecord -- never accepted by PATCH /api/profile.
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [citiesByRegion, primaryRoute, blockedUsers, stats] = await Promise.all([
    getCitiesByRegion(),
    getPrimaryRouteLabel(user),
    prisma.block.findMany({
      where: { blockerId: user.id },
      include: { blocked: { select: { id: true, name: true, photoUrl: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getProfileStats(user.id),
  ]);
  // Same fallback order as the nav header in src/app/layout.tsx: a
  // parent's own email is never expected to be university-verified, so
  // "Not university-verified yet" doesn't apply to them at all -- only show
  // that fallback for non-parents.
  const badge =
    universityBadgeLabel(user) ??
    parentRelationshipBadgeLabel(user) ??
    (user.signedUpAsParent ? null : "Not university-verified yet");

  return (
    <div>
      <h1>Your Profile</h1>

      {user.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.photoUrl}
          alt=""
          width={96}
          height={96}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
      )}

      {badge && <p>{badge}</p>}
      {primaryRoute && <p>{primaryRoute}</p>}
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
      {!hasCompletedOnboarding(user) && (
        <p>Finish setting up your profile below.</p>
      )}

      <ProfileEditForm
        initialName={user.name}
        initialPhotoUrl={user.photoUrl}
        initialHomeCityId={user.homeCityId}
        citiesByRegion={citiesByRegion}
        isParent={user.signedUpAsParent}
        initialMajor={user.major}
        initialYear={user.year}
        initialTravelPreferences={user.travelPreferences}
        initialLookingFor={user.lookingFor}
        initialPhone={user.phone}
        initialLinkedStudentName={user.linkedStudentName}
        submitLabel="Save changes"
      />

      {user.signedUpAsParent && user.parentLinksAsParent.length > 0 && (
        <section>
          <h2>Linked Students</h2>
          <p>Visible only to you.</p>
          <ul>
            {user.parentLinksAsParent.map((link) => (
              <li key={link.id}>
                {link.studentRecord.fullName} —{" "}
                {link.studentRecord.universityDomain.universityName}
                {link.status === "otp_verified" &&
                  " (connection not yet confirmed by student)"}
                {link.status === "revoked" && " (removed)"}
              </li>
            ))}
          </ul>
        </section>
      )}

      {blockedUsers.length > 0 && (
        <section>
          <h2>Blocked Users</h2>
          <p>Visible only to you.</p>
          <ul className="blocked-users-list">
            {blockedUsers.map((b) => (
              <li key={b.id} className="blocked-user-row">
                {b.blocked.name}
                <BlockButton blockedUserId={b.blockedId} initialBlocked={true} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
