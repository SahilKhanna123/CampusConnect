import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile } from "@/lib/profile";
import { lookingForLabel } from "@/lib/lookingFor";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";
import { FadeIn } from "@/components/FadeIn";
import { VerificationBadge } from "@/components/VerificationBadge";

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
  const profile = await getPublicProfile(userId);
  if (!profile) notFound();

  const initialBlocked =
    viewer.id !== userId ? await isBlockedBetween(viewer.id, userId) : false;

  return (
    <div>
      <FadeIn mode="mount" delay={0} className="profile-header">
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photoUrl}
            alt=""
            width={88}
            height={88}
            className="avatar-circle profile-avatar-lg"
          />
        ) : (
          <span className="avatar-circle profile-avatar-lg" aria-hidden="true">
            {profile.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div>
          <h1 className="heading-tight profile-name">{profile.name}</h1>
          {profile.university && <p className="profile-meta">{profile.university}</p>}
          {(profile.major || profile.year) && (
            <p className="profile-meta">
              {[profile.major, profile.year].filter(Boolean).join(" · ")}
            </p>
          )}
          {profile.homeArea && <p className="profile-meta">{profile.homeArea}</p>}
          <div className="profile-badges">
            <VerificationBadge verified={profile.badges.email}>
              {profile.badges.email ? "Email Verified" : "Email not verified"}
            </VerificationBadge>
            <VerificationBadge verified={profile.badges.university}>
              {profile.badges.university ? "University Verified" : "University not verified"}
            </VerificationBadge>
            {profile.badges.parentRelationship && (
              <VerificationBadge verified>Parent Relationship Verified</VerificationBadge>
            )}
            {profile.badges.identity && (
              <VerificationBadge verified>Identity Verified</VerificationBadge>
            )}
          </div>
        </div>
      </FadeIn>

      <FadeIn mode="mount" delay={90}>
        {profile.linkedStudentName && (
          <p className="profile-meta">Connected to {profile.linkedStudentName}</p>
        )}
        {profile.travelPreferences && <p className="profile-meta">{profile.travelPreferences}</p>}
        {profile.lookingFor.length > 0 && (
          <p className="profile-meta">
            Looking for: {profile.lookingFor.map(lookingForLabel).join(", ")}
          </p>
        )}
      </FadeIn>

      {viewer.id !== userId && (
        <FadeIn mode="viewport" className="button-row">
          <ReportButton reportedUserId={userId} contextType="profile" />
          <BlockButton blockedUserId={userId} initialBlocked={initialBlocked} />
        </FadeIn>
      )}
    </div>
  );
}
