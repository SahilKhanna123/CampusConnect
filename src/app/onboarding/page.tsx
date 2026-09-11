import { redirect } from "next/navigation";
import { getCurrentUser, universityBadgeLabel } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { ProfileEditForm } from "@/components/ProfileEditForm";

// Student (and alumni/traveler) onboarding: collect name/photo/home-area
// right after signup verification. This is a SOFT nudge, not a hard gate --
// src/app/layout.tsx never blocks navigation on onboardingCompletedAt, it
// only links here from a banner (see hasCompletedOnboarding in
// src/lib/auth.ts). University and the verified badge are never collected
// here -- they're derived read-only from the existing
// VerificationRecord/StudentRecord, exactly as shown on /profile.
//
// Parent onboarding is a separate flow (step 0 of
// /family/connect-student, since a parent-signup account is hard-gated
// there anyway) -- redirect a parent here to that page instead.
export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.signedUpAsParent) redirect("/family/connect-student");

  const citiesByRegion = await getCitiesByRegion();
  const badge = universityBadgeLabel(user);

  return (
    <div className="form-page">
      <span className="eyebrow">Welcome</span>
      <h1 className="heading-tight">Set up your profile</h1>
      <p className="profile-meta">
        {badge ?? "University verification will appear here once confirmed."}
      </p>
      <ProfileEditForm
        initialName={user.name}
        initialPhotoUrl={user.photoUrl}
        initialHomeCityId={user.homeCityId}
        citiesByRegion={citiesByRegion}
        isParent={false}
        initialMajor={user.major}
        initialYear={user.year}
        initialTravelPreferences={user.travelPreferences}
        initialLookingFor={user.lookingFor}
        initialPhone={user.phone}
        initialLinkedStudentName={null}
        submitLabel="Continue"
        redirectTo="/"
      />
    </div>
  );
}
