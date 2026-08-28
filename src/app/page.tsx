import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getFeaturedRoutePairs } from "@/lib/geo";
import { tripDisplayStatus, requestDisplayStatus } from "@/lib/postStatus";
import { ExploreCard, type ExploreCardPost } from "@/components/ExploreCard";
import type { ConnectionStatus } from "@/components/ConnectionRequestButton";
import { getBlockedCounterpartIds } from "@/lib/blocks";
import { getConfirmedRiderCounts } from "@/lib/tripParticipants";

// Home -- the narrow "surfaces the featured corridor prominently" glance
// view (plan doc: Home features the active RouteCommunity by default,
// Explore/search surface trips across any city pair). Ride-only, same
// "package browsing is separate, out of scope" precedent /explore already
// set -- not an oversight. Reuses Explore's exact Trip/Request query shape
// (see src/app/explore/page.tsx) with an added region-pair filter and no
// filter form/pagination; own posts and blocked users are excluded the
// same way.
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { pairs, isPersonal } = await getFeaturedRoutePairs(user);

  if (pairs.length === 0) {
    return (
      <div>
        <h1>Home</h1>
        <p>We don&apos;t have a featured route configured right now.</p>
        <p>
          <Link href="/explore">See everything on Explore</Link> or{" "}
          <Link href="/post">post a trip or request</Link>.
        </p>
      </div>
    );
  }

  const blockedUserIds = await getBlockedCounterpartIds(user.id);

  const regionPairFilter = {
    OR: pairs.flatMap(({ regionAId, regionBId }) => [
      { originCity: { regionId: regionAId }, destinationCity: { regionId: regionBId } },
      { originCity: { regionId: regionBId }, destinationCity: { regionId: regionAId } },
    ]),
  };

  const [trips, requests] = await Promise.all([
    prisma.trip.findMany({
      where: {
        status: "upcoming",
        travelerId: { not: user.id, notIn: blockedUserIds },
        ...regionPairFilter,
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
        ...regionPairFilter,
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

  // Same batched lookup Explore uses, kept here even though Home's own
  // result set is smaller -- ExploreCard's connectionRequestStatus prop is
  // load-bearing (skipping this would silently make every offer render as
  // an un-requested "Request to Connect" button, even ones the viewer
  // already acted on).
  const myConnectionRequests = await prisma.connectionRequest.findMany({
    where: { requesterId: user.id, tripId: { in: trips.map((t) => t.id) } },
    orderBy: { createdAt: "desc" },
    select: { tripId: true, status: true },
  });
  const connectionStatusByTripId = new Map<string, ConnectionStatus>();
  for (const r of myConnectionRequests) {
    if (!connectionStatusByTripId.has(r.tripId)) {
      connectionStatusByTripId.set(r.tripId, r.status);
    }
  }

  // Same batched confirmed-rider count Explore uses (see
  // src/lib/tripParticipants.ts) -- shown on the card itself.
  const confirmedRiderCounts = await getConfirmedRiderCounts(trips.map((t) => t.id));

  const offerPosts: { sortDate: Date | null; post: ExploreCardPost }[] = trips
    .filter((trip) => tripDisplayStatus(trip) === "upcoming")
    .map((trip) => ({
      sortDate: trip.departureDate,
      post: {
        kind: "offer" as const,
        id: trip.id,
        title: trip.title,
        originName: trip.originCity.name,
        destinationName: trip.destinationCity?.name ?? trip.destinationText ?? "?",
        date: trip.departureDate,
        time: trip.departureTime,
        flexibleTime: trip.flexibleTime,
        seatsTotal: trip.seatsTotal,
        seatsRemaining: trip.seatsRemaining,
        poster: trip.traveler,
        connectionRequestStatus: connectionStatusByTripId.get(trip.id) ?? "none",
        confirmedRiderCount: confirmedRiderCounts.get(trip.id) ?? 0,
      },
    }));

  const requestPosts: { sortDate: Date | null; post: ExploreCardPost }[] = requests
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
      },
    }));

  const posts = [...offerPosts, ...requestPosts].sort((a, b) => {
    if (a.sortDate === null) return 1;
    if (b.sortDate === null) return -1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  });

  const routeLabel = pairs
    .map((p) => `${p.regionAName} ↔ ${p.regionBName}`)
    .join(", ");

  return (
    <div>
      <h1>Home</h1>
      <p>{isPersonal ? `Your route: ${routeLabel}` : `Featured route: ${routeLabel}`}</p>
      <p>
        <Link href="/explore">See everything on Explore</Link> or{" "}
        <Link href="/post">post a trip or request</Link>.
      </p>

      {posts.length === 0 ? (
        <p>Nothing on your route right now.</p>
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
