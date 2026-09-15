import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { MarkTripCompleteButton } from "@/components/MarkTripCompleteButton";
import { MarkPackagePostCompleteButton } from "@/components/MarkPackagePostCompleteButton";

// Lists the current user's own Trip and PackagePost posts -- travelerId /
// postedById are the ownership fields the API routes enforce too (see
// src/app/api/{trips,package-posts}/[id]/route.ts).
//
// Trips bucket by tripDisplayStatus: a cancelled-but-future-dated trip used
// to sit
// under Upcoming with just a "(cancelled)" label, which is exactly the
// muddled experience the Trip Management feature was asked to fix -- a
// trip only counts as Upcoming while it's actually actionable
// (tripDisplayStatus === "upcoming"); cancelled/completed/expired trips all
// move to the History tab, sub-grouped there so each state reads clearly
// on its own per the Trip Management spec, rather than one flat list with
// an inline status word.
export default async function MyPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "history" ? "history" : "upcoming";

  const [trips, packagePosts] = await Promise.all([
    prisma.trip.findMany({
      where: { travelerId: user.id },
      include: { originCity: true, destinationCity: true },
      orderBy: { departureDate: "desc" },
    }),
    prisma.packagePost.findMany({
      where: { postedById: user.id },
      include: { originCity: true, destinationCity: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // One grouped query for every trip's connection-request counts, rather
  // than a per-trip fetch (would be N+1) -- surfaces "relevant connection
  // information" per the Trip Management spec without needing a new
  // feature, just a count of what already exists on ConnectionRequest.
  const connectionCounts =
    trips.length > 0
      ? await prisma.connectionRequest.groupBy({
          by: ["tripId", "status"],
          where: { tripId: { in: trips.map((t) => t.id) } },
          _count: true,
        })
      : [];
  const countsByTrip = new Map<string, { total: number; accepted: number }>();
  for (const c of connectionCounts) {
    const entry = countsByTrip.get(c.tripId) ?? { total: 0, accepted: 0 };
    entry.total += c._count;
    if (c.status === "accepted") entry.accepted += c._count;
    countsByTrip.set(c.tripId, entry);
  }

  const upcomingTrips = trips.filter((t) => tripDisplayStatus(t) === "upcoming");
  const completedTrips = trips.filter((t) => tripDisplayStatus(t) === "completed");
  const cancelledTrips = trips.filter((t) => tripDisplayStatus(t) === "cancelled");
  const expiredTrips = trips.filter((t) => tripDisplayStatus(t) === "expired");

  const openPackagePosts = packagePosts.filter((p) => p.status === "open");
  const closedPackagePosts = packagePosts.filter((p) => p.status !== "open");
  const shownPackagePosts =
    activeTab === "history" ? closedPackagePosts : openPackagePosts;

  function connectionSummary(tripId: string) {
    const counts = countsByTrip.get(tripId);
    if (!counts || counts.total === 0) return null;
    return (
      <span className="trip-connection-summary">
        {counts.total} connection request{counts.total === 1 ? "" : "s"}
        {counts.accepted > 0 && ` (${counts.accepted} accepted)`}
      </span>
    );
  }

  function tripCard(trip: (typeof trips)[number], statusKey: string, statusLabel: string) {
    return (
      <div key={trip.id} className="list-card">
        <div className="list-card-top">
          <Link href={`/trips/${trip.id}`} className="list-card-title">
            {trip.studentsOnly && "🎓 "}
            {trip.title || "Untitled trip"}
          </Link>
          <span className={`trip-status-label trip-status-label-${statusKey}`}>
            {statusLabel}
          </span>
        </div>
        <div className="list-card-meta">
          {trip.originCity.name} → {trip.destinationCity?.name ?? trip.destinationText} —{" "}
          {trip.departureDate.toLocaleDateString()}
          {countsByTrip.get(trip.id) && " · "}
          {connectionSummary(trip.id)}
        </div>
        {(statusKey === "upcoming" || statusKey === "expired") && (
          <div className="list-card-actions">
            <Link href={`/trips/${trip.id}/edit`} className="btn-secondary">
              Edit
            </Link>
            <MarkTripCompleteButton tripId={trip.id} />
            <DeletePostButton
              deleteUrl={`/api/trips/${trip.id}`}
              redirectTo="/my-posts"
              actionLabel="Cancel Trip"
              confirmMessage="Cancel this trip? Anyone with a pending or accepted connection request will be notified. This can't be undone."
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">My Posts</span>
          <h1 className="heading-tight">Your trips &amp; posts</h1>
        </div>
        <div className="page-header-actions">
          <Link href="/post" className="btn-primary">
            Create a new post
          </Link>
        </div>
      </div>

      <div className="subtabs" aria-label="My posts view">
        <Link
          href="/my-posts"
          aria-current={activeTab === "upcoming" ? "page" : undefined}
          className={activeTab === "upcoming" ? "subtab subtab-active" : "subtab"}
        >
          Upcoming
        </Link>
        <Link
          href="/my-posts?tab=history"
          aria-current={activeTab === "history" ? "page" : undefined}
          className={activeTab === "history" ? "subtab subtab-active" : "subtab"}
        >
          History
        </Link>
      </div>

      <div className="list-section">
        <h2 className="list-section-title">Trips You&apos;re Offering</h2>
        {activeTab === "upcoming" ? (
          upcomingTrips.length === 0 ? (
            <p>No upcoming trips posted yet.</p>
          ) : (
            upcomingTrips.map((trip) => tripCard(trip, "upcoming", "Upcoming"))
          )
        ) : (
          <>
            {completedTrips.length === 0 && cancelledTrips.length === 0 && expiredTrips.length === 0 ? (
              <p>No trip history yet.</p>
            ) : (
              <>
                {completedTrips.length > 0 && (
                  <>
                    <h3 className="list-section-title">Completed</h3>
                    {completedTrips.map((trip) => tripCard(trip, "completed", "Completed"))}
                  </>
                )}
                {cancelledTrips.length > 0 && (
                  <>
                    <h3 className="list-section-title">Cancelled</h3>
                    {cancelledTrips.map((trip) => tripCard(trip, "cancelled", "Cancelled"))}
                  </>
                )}
                {expiredTrips.length > 0 && (
                  <>
                    <h3 className="list-section-title">Past due</h3>
                    <p className="list-card-meta">
                      These trips&apos; dates have passed without being marked
                      completed or cancelled.
                    </p>
                    {expiredTrips.map((trip) => tripCard(trip, "expired", "Past due"))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="list-section">
        <h2 className="list-section-title">Package Posts</h2>
        {shownPackagePosts.length === 0 ? (
          <p>
            {activeTab === "history"
              ? "No past package posts."
              : "No open package posts yet."}
          </p>
        ) : (
          shownPackagePosts.map((p) => (
            <div key={p.id} className="list-card">
              <div className="list-card-top">
                <Link href={`/package-posts/${p.id}`} className="list-card-title">
                  {p.studentsOnly && "🎓 "}
                  📦 {p.originCity.name} → {p.destinationCity?.name ?? p.destinationText}
                </Link>
                <span className={`trip-status-label trip-status-label-${p.status}`}>
                  {p.status}
                </span>
              </div>
              {p.date && (
                <div className="list-card-meta">{p.date.toLocaleDateString()}</div>
              )}
              {p.status === "open" && (
                <div className="list-card-actions">
                  <Link href={`/package-posts/${p.id}/edit`} className="btn-secondary">
                    Edit
                  </Link>
                  <MarkPackagePostCompleteButton packagePostId={p.id} />
                  <DeletePostButton
                    deleteUrl={`/api/package-posts/${p.id}`}
                    redirectTo="/my-posts"
                    actionLabel="Cancel post"
                    confirmMessage="Cancel this post? This can't be undone."
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
