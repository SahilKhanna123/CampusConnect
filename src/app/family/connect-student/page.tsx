import { redirect } from "next/navigation";
import { getCurrentUser, hasCompletedOnboarding } from "@/lib/auth";
import { ConnectStudentClient } from "./ConnectStudentClient";

// Server wrapper: fetches what the client wizard needs (the parent's
// current profile fields to prefill step 0) and decides whether step 0 is
// needed at all -- a parent who already completed onboarding (e.g. linking
// a second student later) skips straight to the email step.
export default async function ConnectStudentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <ConnectStudentClient
      initialName={user.name}
      initialPhotoUrl={user.photoUrl}
      initialHomeCityId={user.homeCityId}
      initialHomeCity={
        user.homeCity
          ? { id: user.homeCity.id, name: user.homeCity.name, regionName: user.homeCity.region.name }
          : null
      }
      initialPhone={user.phone}
      initialLinkedStudentName={user.linkedStudentName}
      skipProfileStep={hasCompletedOnboarding(user)}
    />
  );
}
