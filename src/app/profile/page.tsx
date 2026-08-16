// Profile — name, photo, college, home area, verification badges, rating,
// completed trips/deliveries, reviews. Verification badges render per
// VerificationRecord row (independent per type), not a single "verified" flag.
// TODO: fetch current user + aggregate rating/counts from Review/Request.

export default function ProfilePage() {
  return (
    <div>
      <h1>Profile</h1>
      <p>Verification badges, rating, and trip history will appear here.</p>
    </div>
  );
}
