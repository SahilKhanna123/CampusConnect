import { redirect } from "next/navigation";
import {
  getCurrentUser,
  universityBadgeLabel,
  parentRelationshipBadgeLabel,
  hasCompletedOnboarding,
} from "@/lib/auth";
import { getPrimaryRouteLabel } from "@/lib/geo";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { BlockButton } from "@/components/BlockButton";
import { prisma } from "@/lib/prisma";
import { FadeIn } from "@/components/FadeIn";

// Self profile view + edit. Name/photo/home-area are editable here (per
// "students should eventually be able to edit non-verification
// information"); university and verification badges are always read-only,
// derived from VerificationRecord -- never accepted by PATCH /api/profile.
// Trip-history aggregation is intentionally not built here yet (out of
// scope for this feature, tracked separately).
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [primaryRoute, blockedUsers] = await Promise.all([
    getPrimaryRouteLabel(user),
    prisma.block.findMany({
      where: { blockerId: user.id },
      include: { blocked: { select: { id: true, name: true, photoUrl: true } } },
      orderBy: { createdAt: "desc" },
    }),
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
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Profile</span>
        <div className="profile-header">
          {user.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoUrl}
              alt=""
              width={88}
              height={88}
              className="avatar-circle profile-avatar-lg"
            />
          ) : (
            <span className="avatar-circle profile-avatar-lg" aria-hidden="true">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="heading-tight profile-name">{user.name}</h1>
            {primaryRoute && <p className="profile-meta">{primaryRoute}</p>}
            <div className="profile-badges">
              {badge && (
                <span
                  className={
                    badge === "Not university-verified yet"
                      ? "badge-students-only"
                      : "badge-verified"
                  }
                >
                  {badge}
                </span>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn mode="mount" delay={90}>
        {!hasCompletedOnboarding(user) && (
          <p className="onboarding-nudge">Finish setting up your profile below.</p>
        )}

        <ProfileEditForm
          initialName={user.name}
          initialPhotoUrl={user.photoUrl}
          initialHomeCityId={user.homeCityId}
          initialHomeCity={
            user.homeCity
              ? { id: user.homeCity.id, name: user.homeCity.name, regionName: user.homeCity.region.name }
              : null
          }
          isParent={user.signedUpAsParent}
          initialMajor={user.major}
          initialYear={user.year}
          initialTravelPreferences={user.travelPreferences}
          initialLookingFor={user.lookingFor}
          initialPhone={user.phone}
          initialLinkedStudentName={user.linkedStudentName}
          submitLabel="Save changes"
        />
      </FadeIn>

      {user.signedUpAsParent && user.parentLinksAsParent.length > 0 && (
        <FadeIn mode="viewport">
          <section className="profile-section">
            <h2 className="profile-section-title">Linked Students</h2>
            <p className="profile-section-hint">Visible only to you.</p>
            <ul className="blocked-users-list">
              {user.parentLinksAsParent.map((link) => (
                <li key={link.id} className="blocked-user-row">
                  <span>
                    {link.studentRecord.fullName} —{" "}
                    {link.studentRecord.universityDomain.universityName}
                  </span>
                  {link.status === "otp_verified" && (
                    <span className="connection-status-label connection-status-label-pending">
                      unconfirmed
                    </span>
                  )}
                  {link.status === "revoked" && (
                    <span className="connection-status-label connection-status-label-cancelled">
                      removed
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </FadeIn>
      )}

      {blockedUsers.length > 0 && (
        <FadeIn mode="viewport">
          <section className="profile-section">
            <h2 className="profile-section-title">Blocked Users</h2>
            <p className="profile-section-hint">Visible only to you.</p>
            <ul className="blocked-users-list">
              {blockedUsers.map((b) => (
                <li key={b.id} className="blocked-user-row">
                  <span>{b.blocked.name}</span>
                  <BlockButton blockedUserId={b.blockedId} initialBlocked={true} />
                </li>
              ))}
            </ul>
          </section>
        </FadeIn>
      )}
    </div>
  );
}
