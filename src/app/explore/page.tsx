import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { tripDisplayStatus, requestDisplayStatus } from "@/lib/postStatus";
import { type ExploreCardPost } from "@/components/ExploreCard";
import { ExploreMapView } from "@/components/ExploreMapView";
import { ExploreFilters } from "@/components/ExploreFilters";
import type { ConnectionStatus } from "@/components/ConnectionRequestButton";
import { getBlockedCounterpartIds } from "@/lib/blocks";
import { getConfirmedRiderCounts } from "@/lib/tripParticipants";
import { resolvePostCoordinates } from "@/lib/geocode";

const PAGE_SIZE = 4;

function parseDateFilter(date?: string) {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(`${date}T23:59:59.999`);
  return { gte: start, lte: end };
}

type TripRow = Awaited<ReturnType<typeof fetchTrips>>[number];
type RequestRow = Awaited<ReturnType<typeof fetchRequests>>[number];
type SortableRow =
  | { kind: "offer"; sortDate: Date | null; trip: TripRow }
  | { kind: "request"; sortDate: Date | null; request: RequestRow };

// Selected on every poster below -- year and universityName feed the
// card's real "university 'YY" stats-line segment (see resolvePosterStats
// and PosterBadge in ExploreCard.tsx). studentRecord is nullable (a parent/
// alumni/traveler poster has none), so universityName is derived as
// optional-chained rather than assumed present.
const posterSelect = {
  id: true,
  name: true,
  photoUrl: true,
  signedUpAsParent: true,
  year: true,
  verifications: {
    where: { status: "verified" as const },
    select: { type: true, status: true },
  },
  studentRecord: {
    select: { universityDomain: { select: { universityName: true } } },
  },
} as const;

function fetchTrips(where: NonNullable<Parameters<typeof prisma.trip.findMany>[0]>["where"]) {
  return prisma.trip.findMany({
    where,
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      traveler: { select: posterSelect },
    },
    orderBy: { departureDate: "asc" },
  });
}

function fetchRequests(where: NonNullable<Parameters<typeof prisma.request.findMany>[0]>["where"]) {
  return prisma.request.findMany({
    where,
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      postedBy: { select: posterSelect },
    },
    orderBy: { createdAt: "desc" },
  });
}

type PosterRow = { id: string; name: string } & Record<string, unknown>;
type PosterStats = { averageRating: number | null; completedTripCount: number };

// Real (never fabricated) stats for the card's poster line -- an average
// of Review.rating across every review the poster has received, and a
// completed-trip count that counts BOTH sides of this app's two ways to
// complete a trip (a Trip the poster drove to completion as travelerId,
// and a standalone Request the poster completed as its postedById rider --
// see the Trip Management and Request/Trip Matching Lifecycle sections of
// CLAUDE.md). Batched across every poster on the current page via three
// groupBy queries, not one query per card. Deliberately scoped to exactly
// this one page's use -- this is NOT the profile-level rating aggregation
// CLAUDE.md's Reviews section describes as a separately deferred feature;
// it's a narrower, page-local computation that happens to use the same
// underlying Review rows.
async function resolvePosterStats(posterIds: string[]): Promise<Map<string, PosterStats>> {
  const result = new Map<string, PosterStats>();
  if (posterIds.length === 0) return result;

  const [ratings, completedTrips, completedRequests] = await Promise.all([
    prisma.review.groupBy({
      by: ["revieweeId"],
      where: { revieweeId: { in: posterIds } },
      _avg: { rating: true },
    }),
    prisma.trip.groupBy({
      by: ["travelerId"],
      where: { travelerId: { in: posterIds }, status: "completed" },
      _count: { _all: true },
    }),
    prisma.request.groupBy({
      by: ["postedById"],
      where: { postedById: { in: posterIds }, status: "completed" },
      _count: { _all: true },
    }),
  ]);

  for (const id of posterIds) {
    result.set(id, { averageRating: null, completedTripCount: 0 });
  }
  for (const row of ratings) {
    const entry = result.get(row.revieweeId);
    if (entry) entry.averageRating = row._avg.rating;
  }
  for (const row of completedTrips) {
    const entry = result.get(row.travelerId);
    if (entry) entry.completedTripCount += row._count._all;
  }
  for (const row of completedRequests) {
    const entry = result.get(row.postedById);
    if (entry) entry.completedTripCount += row._count._all;
  }
  return result;
}

function buildPoster<T extends PosterRow>(user: T, stats: Map<string, PosterStats>) {
  const s = stats.get(user.id);
  return {
    ...user,
    universityName:
      (user.studentRecord as { universityDomain: { universityName: string } } | null)
        ?.universityDomain.universityName ?? null,
    averageRating: s?.averageRating ?? null,
    completedTripCount: s?.completedTripCount ?? 0,
  };
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
    page?: string;
  }>;
}) {
  // Deliberately not gated: an unauthenticated visitor gets a read-only
  // preview of this page (public browse, per product decision) -- every
  // interaction entry point below (ConnectionRequestButton) still requires
  // signing up, and the underlying API routes already 401 with no session
  // regardless of what this page renders.
  const user = await getCurrentUser();

  const { originCityId, destinationCityId, date, kind, page } = await searchParams;
  const showOffers = kind !== "request";
  const showRequests = kind !== "offer";
  const dateFilter = parseDateFilter(date);
  const hasActiveFilter = Boolean(originCityId || destinationCityId || date || kind);

  // A blocked pair disappears from each other's Explore results regardless
  // of who initiated the block (plan doc §7) -- fetched once up front and
  // applied to both the Trip and Request queries below. An anonymous
  // visitor has no blocks of their own, so nothing to exclude on that
  // basis.
  const blockedUserIds = user ? await getBlockedCounterpartIds(user.id) : [];
  // A non-student viewer never sees a studentsOnly post at all -- see the
  // schema comment on Request.studentsOnly. A student viewer sees both, so
  // no extra filter is added for them. An anonymous visitor is treated the
  // same as any other non-student.
  const isStudent = user ? hasStudentRecord(user) : false;
  const studentsOnlyFilter = isStudent ? {} : { studentsOnly: false };

  const [citiesByRegion, trips, requests] = await Promise.all([
    getCitiesByRegion(),
    fetchTrips({
      status: "upcoming",
      travelerId: user
        ? { not: user.id, notIn: blockedUserIds }
        : { notIn: blockedUserIds },
      ...studentsOnlyFilter,
      ...(originCityId ? { originCityId } : {}),
      ...(destinationCityId ? { destinationCityId } : {}),
      ...(dateFilter ? { departureDate: dateFilter } : {}),
    }),
    fetchRequests({
      tripId: null,
      status: "pending",
      postedById: user
        ? { not: user.id, notIn: blockedUserIds }
        : { notIn: blockedUserIds },
      ...studentsOnlyFilter,
      ...(originCityId ? { originCityId } : {}),
      ...(destinationCityId ? { destinationCityId } : {}),
      ...(dateFilter ? { neededDate: dateFilter } : {}),
    }),
  ]);

  // Sort the full (unpaginated) set first -- pagination has to slice
  // *after* offers and requests are merged and ordered, since a page's 6
  // slots can mix both kinds. The expensive per-post enrichments below
  // (connection status, confirmed-rider counts, geocoded coordinates) only
  // ever run against the resulting page-sized slice, not the full result
  // set, so browsing page 1 of a large Explore result doesn't pay for work
  // on posts that aren't even rendered yet.
  const offerRows: SortableRow[] = showOffers
    ? trips
        .filter((trip) => tripDisplayStatus(trip) === "upcoming")
        .map((trip) => ({ kind: "offer" as const, sortDate: trip.departureDate, trip }))
    : [];
  const requestRows: SortableRow[] = showRequests
    ? requests
        .filter((r) => requestDisplayStatus(r) === "pending")
        .map((r) => ({ kind: "request" as const, sortDate: r.neededDate, request: r }))
    : [];

  const allRows = [...offerRows, ...requestRows].sort((a, b) => {
    if (a.sortDate === null) return 1;
    if (b.sortDate === null) return -1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  });

  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE));
  const requestedPage = parseInt(page ?? "1", 10);
  const currentPage = Math.min(
    Math.max(1, Number.isNaN(requestedPage) ? 1 : requestedPage),
    totalPages,
  );
  const pagedRows = allRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pagedTrips = pagedRows
    .filter((r): r is Extract<SortableRow, { kind: "offer" }> => r.kind === "offer")
    .map((r) => r.trip);
  const pagedRequests = pagedRows
    .filter((r): r is Extract<SortableRow, { kind: "request" }> => r.kind === "request")
    .map((r) => r.request);

  // One batch query for the viewer's own ConnectionRequests against every
  // Trip on this *page*, rather than a per-card fetch (would be N+1). A trip
  // can have more than one row over time (a fresh request is allowed again
  // after a decline/cancel, see the ConnectionRequest schema comment) --
  // ordering desc and only keeping the first-seen row per tripId picks the
  // most recent one.
  const myConnectionRequests = pagedTrips.length > 0 && user
    ? await prisma.connectionRequest.findMany({
        where: { requesterId: user.id, tripId: { in: pagedTrips.map((t) => t.id) } },
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

  // Confirmed-rider counts, batched across every Trip card on this page --
  // shown on the card itself so confirmed riders are visible even before
  // clicking through to the trip's own public Riders roster (see
  // src/lib/tripParticipants.ts and the Trip Participants/Seat Offers
  // sections of CLAUDE.md).
  const confirmedRiderCounts = await getConfirmedRiderCounts(pagedTrips.map((t) => t.id));

  // Real-world coordinates for the route map (see RouteMap.tsx), resolved
  // once across every Trip and Request on this page -- see
  // resolvePostCoordinates for why this is batched rather than per-post.
  const [tripCoords, requestCoords] = await Promise.all([
    resolvePostCoordinates(pagedTrips),
    resolvePostCoordinates(pagedRequests),
  ]);

  // Real rating/completed-trip stats for the card's poster line, batched
  // across every distinct poster on this page -- see resolvePosterStats.
  const posterIds = [
    ...new Set([
      ...pagedTrips.map((t) => t.traveler.id),
      ...pagedRequests.map((r) => r.postedBy.id),
    ]),
  ];
  const posterStats = await resolvePosterStats(posterIds);

  const posts: ExploreCardPost[] = pagedRows.map((row) => {
    if (row.kind === "offer") {
      const trip = row.trip;
      return {
        kind: "offer" as const,
        id: trip.id,
        title: trip.title,
        originName: trip.originCity.name,
        destinationName: trip.destinationCity?.name ?? trip.destinationText ?? "?",
        originRegionName: trip.originCity.region.name,
        destinationRegionName: trip.destinationCity?.region?.name ?? null,
        ...tripCoords.get(trip),
        date: trip.departureDate,
        time: trip.departureTime,
        flexibleTime: trip.flexibleTime,
        seatsTotal: trip.seatsTotal,
        seatsRemaining: trip.seatsRemaining,
        poster: buildPoster(trip.traveler, posterStats),
        connectionRequestStatus: connectionStatusByTripId.get(trip.id) ?? "none",
        confirmedRiderCount: confirmedRiderCounts.get(trip.id) ?? 0,
        studentsOnly: trip.studentsOnly,
        note: trip.tripNotes,
      };
    }
    const r = row.request;
    return {
      kind: "request" as const,
      id: r.id,
      originName: r.originCity?.name ?? "?",
      destinationName: r.destinationCity?.name ?? r.destinationText ?? "?",
      originRegionName: r.originCity?.region?.name ?? null,
      destinationRegionName: r.destinationCity?.region?.name ?? null,
      ...requestCoords.get(r),
      date: r.neededDate,
      time: r.neededTime,
      flexibleTime: r.flexibleTime,
      seatsRequested: r.seatsRequested ?? 1,
      poster: buildPoster(r.postedBy, posterStats),
      studentsOnly: r.studentsOnly,
      note: r.notes,
    };
  });

  // Preserves the active filters while only changing `page` -- page 1 is
  // the default and never appears in the URL, matching hasActiveFilter's
  // own "only show what's non-default" convention.
  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (originCityId) params.set("originCityId", originCityId);
    if (destinationCityId) params.set("destinationCityId", destinationCityId);
    if (date) params.set("date", date);
    if (kind) params.set("kind", kind);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/explore?${query}` : "/explore";
  }

  return (
    <div>
      <span className="eyebrow">Explore</span>
      <h1 className="heading-tight">Trips &amp; ride requests</h1>
      <p>Browse what the community has posted, or hover a card to see its route.</p>

      <ExploreFilters
        citiesByRegion={citiesByRegion}
        originCityId={originCityId}
        destinationCityId={destinationCityId}
        date={date}
        kind={kind}
        hasActiveFilter={hasActiveFilter}
      />

      <ExploreMapView posts={posts} isLoggedIn={!!user} />

      {totalPages > 1 && (
        <div className="pagination-row">
          {currentPage > 1 ? (
            <Link href={pageHref(currentPage - 1)} className="btn-secondary">
              ← Previous
            </Link>
          ) : (
            <span className="btn-secondary pagination-disabled">← Previous</span>
          )}
          <span className="pagination-status">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages ? (
            <Link href={pageHref(currentPage + 1)} className="btn-secondary">
              Next →
            </Link>
          ) : (
            <span className="btn-secondary pagination-disabled">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
