import { redirect } from "next/navigation";
import {
  getCurrentUser,
  universityBadgeLabel,
  parentRelationshipBadgeLabel,
  hasCompletedOnboarding,
} from "@/lib/auth";
import { getCitiesByRegion, getPrimaryRouteLabel } from "@/lib/geo";
import { ProfileEditForm } from "@/components/ProfileEditForm";

// Self profile view + edit. Name/photo/home-area are editable here (per
// "students should eventually be able to edit non-verification
// information"); university and verification badges are always read-only,
// derived from VerificationRecord -- never accepted by PATCH /api/profile.
// Rating/trip-history aggregation from Review/Request is intentionally not
// built here yet (out of scope for this feature, tracked separately).
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [citiesByRegion, primaryRoute] = await Promise.all([
    getCitiesByRegion(),
    getPrimaryRouteLabel(user),
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
    </div>
  );
}
