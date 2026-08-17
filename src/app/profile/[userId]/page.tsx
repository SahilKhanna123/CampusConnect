import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile } from "@/lib/profile";

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
      {profile.homeArea && <p>{profile.homeArea}</p>}
      <ul>
        {profile.badges.email && <li>✓ Email Verified</li>}
        {profile.badges.university && <li>✓ University Verified</li>}
        {profile.badges.parentRelationship && (
          <li>✓ Parent Relationship Verified</li>
        )}
        {profile.badges.identity && <li>✓ Identity Verified</li>}
      </ul>
    </div>
  );
}
