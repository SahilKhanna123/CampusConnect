import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestDisplayStatus, tripDisplayStatus } from "@/lib/postStatus";

// Lists the current user's own Trip (offer) and Request (need) posts --
// travelerId / postedById are the ownership fields the API routes enforce
// too (see src/app/api/{trips,requests}/[id]/route.ts). Cancelled posts
// stay visible here with a status label rather than disappearing, same as
// how a revoked ParentStudentLink still shows on /profile.
//
// Upcoming vs. History is purely a date split (Trip.departureDate /
// Request.neededDate vs. "now"), independent of status -- a cancelled post
// that was scheduled for the future still shows under Upcoming with its
// (cancelled) label, matching the "nothing here disappears" convention
// above. A Request with no neededDate has no date to have passed, so it
// always stays under Upcoming.
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

  const now = new Date();
  const pastTrips = trips.filter((trip) => trip.departureDate < now);
  const upcomingTrips = trips.filter((trip) => trip.departureDate >= now);
  const pastRequests = requests.filter(
    (r) => r.neededDate !== null && r.neededDate < now
  );
  const upcomingRequests = requests.filter(
    (r) => r.neededDate === null || r.neededDate >= now
  );

  const shownTrips = activeTab === "history" ? pastTrips : upcomingTrips;
  const shownRequests =
    activeTab === "history" ? pastRequests : upcomingRequests;

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
      {shownTrips.length === 0 ? (
        <p>
          {activeTab === "history"
            ? "No past trips."
            : "No upcoming trips posted yet."}
        </p>
      ) : (
        <ul>
          {shownTrips.map((trip) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`}>
                {trip.title || "Untitled trip"}:{" "}
                {trip.originCity.name} →{" "}
                {trip.destinationCity?.name ?? trip.destinationText} —{" "}
                {trip.departureDate.toLocaleDateString()}
              </Link>
              {" "}({tripDisplayStatus(trip)})
            </li>
          ))}
        </ul>
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
