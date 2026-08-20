import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestDisplayStatus, tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { MarkTripCompleteButton } from "@/components/MarkTripCompleteButton";

// Lists the current user's own Trip (offer) and Request (need) posts --
// travelerId / postedById are the ownership fields the API routes enforce
// too (see src/app/api/{trips,requests}/[id]/route.ts).
//
// Requests keep the original purely-date-based Upcoming/History split
// (Request has no owner-driven "mark completed" step yet -- see CLAUDE.md,
// requests/[id]/complete is still a stub). Trips now bucket by
// tripDisplayStatus instead: a cancelled-but-future-dated trip used to sit
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

  const [trips, requests] = await Promise.all([
    prisma.trip.findMany({
      where: { travelerId: user.id },
      include: { originCity: true, destinationCity: true },
      orderBy: { departureDate: "desc" },
    }),
    prisma.request.findMany({
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

  const now = new Date();
  const upcomingTrips = trips.filter((t) => tripDisplayStatus(t) === "upcoming");
  const completedTrips = trips.filter((t) => tripDisplayStatus(t) === "completed");
  const cancelledTrips = trips.filter((t) => tripDisplayStatus(t) === "cancelled");
  const expiredTrips = trips.filter((t) => tripDisplayStatus(t) === "expired");

  const pastRequests = requests.filter(
    (r) => r.neededDate !== null && r.neededDate < now
  );
  const upcomingRequests = requests.filter(
    (r) => r.neededDate === null || r.neededDate >= now
  );
  const shownRequests = activeTab === "history" ? pastRequests : upcomingRequests;

  function connectionSummary(tripId: string) {
    const counts = countsByTrip.get(tripId);
    if (!counts || counts.total === 0) return null;
    return (
      <span className="trip-connection-summary">
        {" — "}
        {counts.total} connection request{counts.total === 1 ? "" : "s"}
        {counts.accepted > 0 && ` (${counts.accepted} accepted)`}
      </span>
    );
  }

  function tripLabel(trip: (typeof trips)[number]) {
    return (
      <Link href={`/trips/${trip.id}`}>
        {trip.title || "Untitled trip"}: {trip.originCity.name} →{" "}
        {trip.destinationCity?.name ?? trip.destinationText} —{" "}
        {trip.departureDate.toLocaleDateString()}
      </Link>
    );
  }

  return (
    <div>
      <h1>My Posts</h1>
      <p>
        <Link href="/post">Create a new post</Link>
      </p>

      <nav aria-label="My posts view">
        <Link
          href="/my-posts"
          aria-current={activeTab === "upcoming" ? "page" : undefined}
          style={{ fontWeight: activeTab === "upcoming" ? "bold" : "normal" }}
        >
          Upcoming
        </Link>
        {" | "}
        <Link
          href="/my-posts?tab=history"
          aria-current={activeTab === "history" ? "page" : undefined}
          style={{ fontWeight: activeTab === "history" ? "bold" : "normal" }}
        >
          History
        </Link>
      </nav>

      <h2>Trips You&apos;re Offering</h2>
      {activeTab === "upcoming" ? (
        upcomingTrips.length === 0 ? (
          <p>No upcoming trips posted yet.</p>
        ) : (
          <ul>
            {upcomingTrips.map((trip) => (
              <li key={trip.id}>
                {tripLabel(trip)}{" "}
                <span className="trip-status-label trip-status-label-upcoming">
                  (upcoming)
                </span>
                {connectionSummary(trip.id)}
                <div className="trip-row-actions">
                  <Link href={`/trips/${trip.id}/edit`}>Edit</Link>
                  {" · "}
                  <MarkTripCompleteButton tripId={trip.id} />
                  {" · "}
                  <DeletePostButton
                    deleteUrl={`/api/trips/${trip.id}`}
                    redirectTo="/my-posts"
                    actionLabel="Cancel Trip"
                    confirmMessage="Cancel this trip? Anyone with a pending or accepted connection request will be notified. This can't be undone."
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <h3>Completed</h3>
          {completedTrips.length === 0 ? (
            <p>No completed trips.</p>
          ) : (
            <ul>
              {completedTrips.map((trip) => (
                <li key={trip.id}>
                  {tripLabel(trip)}{" "}
                  <span className="trip-status-label trip-status-label-completed">
                    (completed)
                  </span>
                  {connectionSummary(trip.id)}
                </li>
              ))}
            </ul>
          )}

          <h3>Cancelled</h3>
          {cancelledTrips.length === 0 ? (
            <p>No cancelled trips.</p>
          ) : (
            <ul>
              {cancelledTrips.map((trip) => (
                <li key={trip.id}>
                  {tripLabel(trip)}{" "}
                  <span className="trip-status-label trip-status-label-cancelled">
                    (cancelled)
                  </span>
                  {connectionSummary(trip.id)}
                </li>
              ))}
            </ul>
          )}

          {expiredTrips.length > 0 && (
            <>
              <h3>Past due</h3>
              <p>
                These trips&apos; dates have passed without being marked
                completed or cancelled.
              </p>
              <ul>
                {expiredTrips.map((trip) => (
                  <li key={trip.id}>
                    {tripLabel(trip)}{" "}
                    <span className="trip-status-label trip-status-label-expired">
                      (expired)
                    </span>
                    {connectionSummary(trip.id)}
                    <div className="trip-row-actions">
                      <Link href={`/trips/${trip.id}/edit`}>Edit</Link>
                      {" · "}
                      <MarkTripCompleteButton tripId={trip.id} />
                      {" · "}
                      <DeletePostButton
                        deleteUrl={`/api/trips/${trip.id}`}
                        redirectTo="/my-posts"
                        actionLabel="Cancel Trip"
                        confirmMessage="Cancel this trip? Anyone with a pending or accepted connection request will be notified. This can't be undone."
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h2>Your Requests</h2>
      {shownRequests.length === 0 ? (
        <p>
          {activeTab === "history"
            ? "No past requests."
            : "No upcoming requests posted yet."}
        </p>
      ) : (
        <ul>
          {shownRequests.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`}>
                {r.type === "ride" ? "Ride" : "Delivery"}:{" "}
                {r.originCity?.name ?? "?"} →{" "}
                {r.destinationCity?.name ?? r.destinationText ?? "?"}
                {r.neededDate && ` — ${r.neededDate.toLocaleDateString()}`}
              </Link>
              {" "}({requestDisplayStatus(r)})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
