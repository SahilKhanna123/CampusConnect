import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { tripDisplayStatus, requestDisplayStatus } from "@/lib/postStatus";
import { ExploreCard, type ExploreCardPost } from "@/components/ExploreCard";
import type { ConnectionStatus } from "@/components/ConnectionRequestButton";
import { getBlockedCounterpartIds } from "@/lib/blocks";

function parseDateFilter(date?: string) {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(`${date}T23:59:59.999`);
  return { gte: start, lte: end };
}

// Browse active Trip (offer) and standalone ride Request (need) posts from
// OTHER users -- travelerId/postedById exclusions mirror the ownership
// pattern already used by /my-posts and the trip/request detail pages.
// Cancelled/completed/expired posts are excluded (tripDisplayStatus/
// requestDisplayStatus, same derived-at-read-time helpers /my-posts uses --
// nothing here is persisted as "expired"). Package requests aren't included:
// every card field this page shows (origin/destination/date/time/seats/
// offer-vs-request) is ride-shaped, so package browsing is out of scope for
// this feature, not an oversight.
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{
    originCityId?: string;
    destinationCityId?: string;
    date?: string;
    kind?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { originCityId, destinationCityId, date, kind } = await searchParams;
  const showOffers = kind !== "request";
  const showRequests = kind !== "offer";
  const dateFilter = parseDateFilter(date);
  const hasActiveFilter = Boolean(originCityId || destinationCityId || date || kind);

  // A blocked pair disappears from each other's Explore results regardless
  // of who initiated the block (plan doc §7) -- fetched once up front and
  // applied to both the Trip and Request queries below.
  const blockedUserIds = await getBlockedCounterpartIds(user.id);
  // A non-student viewer never sees a studentsOnly post at all -- see the
  // schema comment on Request.studentsOnly. A student viewer sees both, so
  // no extra filter is added for them.
  const isStudent = hasStudentRecord(user);
  const studentsOnlyFilter = isStudent ? {} : { studentsOnly: false };

  const [citiesByRegion, trips, requests] = await Promise.all([
    getCitiesByRegion(),
    prisma.trip.findMany({
      where: {
        status: "upcoming",
        travelerId: { not: user.id, notIn: blockedUserIds },
        ...studentsOnlyFilter,
        ...(originCityId ? { originCityId } : {}),
        ...(destinationCityId ? { destinationCityId } : {}),
        ...(dateFilter ? { departureDate: dateFilter } : {}),
      },
      include: {
        originCity: true,
        destinationCity: true,
        traveler: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            signedUpAsParent: true,
            verifications: {
              where: { status: "verified" },
              select: { type: true, status: true },
            },
          },
        },
      },
      orderBy: { departureDate: "asc" },
    }),
    prisma.request.findMany({
      where: {
        type: "ride",
        tripId: null,
        status: "pending",
        postedById: { not: user.id, notIn: blockedUserIds },
        ...studentsOnlyFilter,
        ...(originCityId ? { originCityId } : {}),
        ...(destinationCityId ? { destinationCityId } : {}),
        ...(dateFilter ? { neededDate: dateFilter } : {}),
      },
      include: {
        originCity: true,
        destinationCity: true,
        postedBy: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            signedUpAsParent: true,
            verifications: {
              where: { status: "verified" },
              select: { type: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // One batch query for the viewer's own ConnectionRequests against every
  // Trip on this page, rather than a per-card fetch (would be N+1). A trip
  // can have more than one row over time (a fresh request is allowed again
  // after a decline/cancel, see the ConnectionRequest schema comment) --
  // ordering desc and only keeping the first-seen row per tripId picks the
  // most recent one.
  const myConnectionRequests = showOffers
    ? await prisma.connectionRequest.findMany({
        where: { requesterId: user.id, tripId: { in: trips.map((t) => t.id) } },
        orderBy: { createdAt: "desc" },
        select: { tripId: true, status: true },
      })
    : [];
  const connectionStatusByTripId = new Map<string, ConnectionStatus>();
  for (const r of myConnectionRequests) {
    if (!connectionStatusByTripId.has(r.tripId)) {
      connectionStatusByTripId.set(r.tripId, r.status);
    }
  }

  const offerPosts: { sortDate: Date | null; post: ExploreCardPost }[] = showOffers
    ? trips
        .filter((trip) => tripDisplayStatus(trip) === "upcoming")
        .map((trip) => ({
          sortDate: trip.departureDate,
          post: {
            kind: "offer" as const,
            id: trip.id,
            title: trip.title,
            originName: trip.originCity.name,
            destinationName:
              trip.destinationCity?.name ?? trip.destinationText ?? "?",
            date: trip.departureDate,
            time: trip.departureTime,
            flexibleTime: trip.flexibleTime,
            seatsTotal: trip.seatsTotal,
            seatsRemaining: trip.seatsRemaining,
            poster: trip.traveler,
            connectionRequestStatus: connectionStatusByTripId.get(trip.id) ?? "none",
            studentsOnly: trip.studentsOnly,
          },
        }))
    : [];

  const requestPosts: { sortDate: Date | null; post: ExploreCardPost }[] = showRequests
    ? requests
        .filter((r) => requestDisplayStatus(r) === "pending")
        .map((r) => ({
          sortDate: r.neededDate,
          post: {
            kind: "request" as const,
            id: r.id,
            originName: r.originCity?.name ?? "?",
            destinationName: r.destinationCity?.name ?? r.destinationText ?? "?",
            date: r.neededDate,
            time: r.neededTime,
            flexibleTime: r.flexibleTime,
            seatsRequested: r.seatsRequested ?? 1,
            poster: r.postedBy,
            studentsOnly: r.studentsOnly,
          },
        }))
    : [];

  const posts = [...offerPosts, ...requestPosts].sort((a, b) => {
    if (a.sortDate === null) return 1;
    if (b.sortDate === null) return -1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  });

  return (
    <div>
      <h1>Explore</h1>
      <p>Browse trips and ride requests from the community.</p>

      <form method="get" className="explore-filters">
        <div>
          <label htmlFor="originCityId">Origin</label>
          <select
            id="originCityId"
            name="originCityId"
            defaultValue={originCityId ?? ""}
          >
            <option value="">Any origin</option>
            {citiesByRegion.map((group) => (
              <optgroup key={group.regionName} label={group.regionName}>
                {group.cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="destinationCityId">Destination</label>
          <select
            id="destinationCityId"
            name="destinationCityId"
            defaultValue={destinationCityId ?? ""}
          >
            <option value="">Any destination</option>
            {citiesByRegion.map((group) => (
              <optgroup key={group.regionName} label={group.regionName}>
                {group.cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" name="date" defaultValue={date ?? ""} />
        </div>
        <div>
          <label htmlFor="kind">Type</label>
          <select id="kind" name="kind" defaultValue={kind ?? ""}>
            <option value="">Offers &amp; requests</option>
            <option value="offer">Offering a ride</option>
            <option value="request">Needs a ride</option>
          </select>
        </div>
        <div>
          <button type="submit">Apply filters</button>
        </div>
        {hasActiveFilter && (
          <div>
            <Link href="/explore">Clear filters</Link>
          </div>
        )}
      </form>

      {posts.length === 0 ? (
        <p>No trips or ride requests match your filters right now.</p>
      ) : (
        <div className="explore-grid">
          {posts.map(({ post }) => (
            <ExploreCard key={`${post.kind}-${post.id}`} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
