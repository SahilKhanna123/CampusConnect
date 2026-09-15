import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { tripDisplayStatus } from "@/lib/postStatus";
import { type ExploreCardPost } from "@/components/ExploreCard";
import { ExploreMapView } from "@/components/ExploreMapView";
import { ExploreFilters } from "@/components/ExploreFilters";
import { ExploreViewTabs, type ExploreView } from "@/components/ExploreViewTabs";
import type { ConnectionStatus } from "@/components/ConnectionRequestButton";
import { getBlockedCounterpartIds } from "@/lib/blocks";
import { getConfirmedRiderCounts } from "@/lib/tripParticipants";
import { resolvePostCoordinates } from "@/lib/geocode";

const PAGE_SIZE = 4;

// Explore's category toggle defaults to "packages" -- package delivery is
// meant to carry the majority of this page's visual weight (per product
// decision, the same 50%+ package-first reweighting already applied to Home
// and the Post hub), not an equal split. The "all" view honors that with a
// 2:1 package:ride interleave (see interleavePackagesAndRides below) rather
// than a plain chronological merge, which is what a Rides-only page
// defaulted to for the entire project's history until now.
function normalizeView(raw: string | undefined): ExploreView {
  return raw === "all" || raw === "rides" ? raw : "packages";
}

// Interleaves two already-sorted row lists at a fixed 2:1 ratio (two package
// rows per one ride row) so the combined "All" view reads as package-
// majority (~67%, within the requested 60-70% range) without needing a
// weighted-random shuffle or a second sort key. Once one list is exhausted,
// the rest of the other is appended in its existing order.
function interleavePackagesAndRides<T>(packages: T[], rides: T[]): T[] {
  const result: T[] = [];
  let i = 0;
  let j = 0;
  while (i < packages.length || j < rides.length) {
    for (let k = 0; k < 2 && i < packages.length; k++) result.push(packages[i++]);
    if (j < rides.length) result.push(rides[j++]);
  }
  return result;
}

function parseDateFilter(date?: string) {
  if (!date) return null;
  const start = new Date(`${date}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(`${date}T23:59:59.999`);
  return { gte: start, lte: end };
}

type TripRow = Awaited<ReturnType<typeof fetchTrips>>[number];
type PackageRow = Awaited<ReturnType<typeof fetchPackagePosts>>[number];
type SortableRow =
  | { kind: "offer"; sortDate: Date | null; trip: TripRow }
  | { kind: "package"; sortDate: Date | null; packagePost: PackageRow };

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

function fetchPackagePosts(
  where: NonNullable<Parameters<typeof prisma.packagePost.findMany>[0]>["where"],
) {
  return prisma.packagePost.findMany({
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
type PosterStats = { completedTripCount: number };

// Real (never fabricated) completed-trip count for the card's poster line --
// every Trip the poster drove to completion as travelerId. Batched across
// every poster on the current page via one groupBy query, not one query per
// card.
async function resolvePosterStats(posterIds: string[]): Promise<Map<string, PosterStats>> {
  const result = new Map<string, PosterStats>();
  if (posterIds.length === 0) return result;

  const completedTrips = await prisma.trip.groupBy({
    by: ["travelerId"],
    where: { travelerId: { in: posterIds }, status: "completed" },
    _count: { _all: true },
  });

  for (const id of posterIds) {
    result.set(id, { completedTripCount: 0 });
  }
  for (const row of completedTrips) {
    const entry = result.get(row.travelerId);
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
    completedTripCount: s?.completedTripCount ?? 0,
  };
}

// Browse Trip offer posts and PackagePost listings from OTHER users --
// travelerId/postedById exclusions mirror the ownership pattern already
// used by /my-posts and the trip/package-post detail pages. Cancelled/
// completed/expired posts are excluded (tripDisplayStatus, the same
// derived-at-read-time helper /my-posts uses -- nothing here is persisted
// as "expired"; PackagePost has no such derived state, `status: "open"`
// alone is the DB-level filter). The `view` query param (see
// ExploreViewTabs) picks which of the two post kinds actually render --
// defaults to "packages", per product decision that package delivery
// should carry the majority of this page's visual weight. There is no
// standalone ride Request to browse -- that flow was removed entirely (see
// Trip Categories & Package Carrying in CLAUDE.md).
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{
    originCityId?: string;
    destinationCityId?: string;
    date?: string;
    view?: string;
    page?: string;
  }>;
}) {
  // Deliberately not gated: an unauthenticated visitor gets a read-only
  // preview of this page (public browse, per product decision) -- every
  // interaction entry point below (ConnectionRequestButton) still requires
  // signing up, and the underlying API routes already 401 with no session
  // regardless of what this page renders.
  const user = await getCurrentUser();

  const { originCityId, destinationCityId, date, view: rawView, page } = await searchParams;
  const view = normalizeView(rawView);
  const showRides = view === "rides" || view === "all";
  const showPackages = view === "packages" || view === "all";
  const dateFilter = parseDateFilter(date);
  const hasActiveFilter = Boolean(originCityId || destinationCityId || date);

  // A blocked pair disappears from each other's Explore results regardless
  // of who initiated the block (plan doc §7) -- fetched once up front and
  // applied to the Trip query below. An anonymous visitor has no blocks of
  // their own, so nothing to exclude on that basis.
  const blockedUserIds = user ? await getBlockedCounterpartIds(user.id) : [];
  // A non-student viewer never sees a studentsOnly post at all -- see the
  // schema comment on Trip.studentsOnly. An anonymous visitor is treated
  // the same as any other non-student.
  const isStudent = user ? hasStudentRecord(user) : false;
  const studentsOnlyFilter = isStudent ? {} : { studentsOnly: false };

  const [citiesByRegion, trips, packagePosts] = await Promise.all([
    getCitiesByRegion(),
    showRides
      ? fetchTrips({
          status: "upcoming",
          travelerId: user
            ? { not: user.id, notIn: blockedUserIds }
            : { notIn: blockedUserIds },
          ...studentsOnlyFilter,
          ...(originCityId ? { originCityId } : {}),
          ...(destinationCityId ? { destinationCityId } : {}),
          ...(dateFilter ? { departureDate: dateFilter } : {}),
        })
      : Promise.resolve([]),
    showPackages
      ? fetchPackagePosts({
          status: "open",
          postedById: user
            ? { not: user.id, notIn: blockedUserIds }
            : { notIn: blockedUserIds },
          ...studentsOnlyFilter,
          ...(originCityId ? { originCityId } : {}),
          ...(destinationCityId ? { destinationCityId } : {}),
          ...(dateFilter ? { date: dateFilter } : {}),
        })
      : Promise.resolve([]),
  ]);

  // Sort the full (unpaginated) set first -- pagination has to slice
  // *after* offers and packages are merged and ordered, since a page's 4
  // slots can mix both kinds. The expensive per-post enrichments below
  // (connection status, confirmed-rider counts, geocoded coordinates) only
  // ever run against the resulting page-sized slice, not the full result
  // set, so browsing page 1 of a large Explore result doesn't pay for work
  // on posts that aren't even rendered yet.
  const offerRows: SortableRow[] = trips
    .filter((trip) => tripDisplayStatus(trip) === "upcoming")
    .map((trip) => ({ kind: "offer" as const, sortDate: trip.departureDate, trip }));
  const packageRows: SortableRow[] = packagePosts.map((p) => ({
    kind: "package" as const,
    sortDate: p.date,
    packagePost: p,
  }));

  function byDateAscNullsLast(a: SortableRow, b: SortableRow) {
    if (a.sortDate === null) return 1;
    if (b.sortDate === null) return -1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  }

  // "all" deliberately doesn't just chronologically merge both kinds --
  // that would let ride volume (this app's original, longer-established
  // feature) drown out packages the same way it has for this page's entire
  // history. A fixed 2:1 package:ride interleave keeps package delivery the
  // majority of what's visible, matching the same package-first reweighting
  // already applied to Home and the Post hub.
  const allRows: SortableRow[] =
    view === "all"
      ? interleavePackagesAndRides(
          packageRows.sort(byDateAscNullsLast),
          offerRows.sort(byDateAscNullsLast),
        )
      : view === "packages"
        ? packageRows.sort(byDateAscNullsLast)
        : offerRows.sort(byDateAscNullsLast);

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
  const pagedPackages = pagedRows
    .filter((r): r is Extract<SortableRow, { kind: "package" }> => r.kind === "package")
    .map((r) => r.packagePost);

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
  // once across every Trip and PackagePost on this page -- see
  // resolvePostCoordinates for why this is batched rather than per-post.
  const [tripCoords, packageCoords] = await Promise.all([
    resolvePostCoordinates(pagedTrips),
    resolvePostCoordinates(pagedPackages),
  ]);

  // Real completed-trip stats for the card's poster line, batched across
  // every distinct poster on this page -- see resolvePosterStats.
  const posterIds = [
    ...new Set([
      ...pagedTrips.map((t) => t.traveler.id),
      ...pagedPackages.map((p) => p.postedBy.id),
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
    const p = row.packagePost;
    return {
      kind: "package" as const,
      id: p.id,
      originName: p.originCity.name,
      destinationName: p.destinationCity?.name ?? p.destinationText ?? "?",
      originRegionName: p.originCity.region.name,
      destinationRegionName: p.destinationCity?.region?.name ?? null,
      ...packageCoords.get(p),
      date: p.date,
      time: p.time,
      flexibleTime: p.flexibleTime,
      poster: buildPoster(p.postedBy, posterStats),
      studentsOnly: p.studentsOnly,
      note: p.notes,
    };
  });

  // Preserves the active filters while only changing `page` -- page 1 is
  // the default and never appears in the URL, matching hasActiveFilter's
  // own "only show what's non-default" convention. Also preserves `view`
  // (packages, the default, is never written into the URL, same convention
  // ExploreViewTabs already follows).
  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (originCityId) params.set("originCityId", originCityId);
    if (destinationCityId) params.set("destinationCityId", destinationCityId);
    if (date) params.set("date", date);
    if (view !== "packages") params.set("view", view);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/explore?${query}` : "/explore";
  }

  const heading =
    view === "packages"
      ? "Package deliveries"
      : view === "rides"
        ? "Trips"
        : "Everything on the move";
  const subheading =
    view === "packages"
      ? "Browse package space posted by the community."
      : "Browse what the community has posted, or hover a card to see its route.";
  const emptyMessage =
    view === "packages"
      ? "No package posts match your filters right now."
      : view === "rides"
        ? "No trips match your filters right now."
        : "Nothing matches your filters right now.";

  return (
    <div>
      <span className="eyebrow">Explore</span>
      <h1 className="heading-tight">{heading}</h1>
      <p>{subheading}</p>

      <ExploreViewTabs
        activeView={view}
        originCityId={originCityId}
        destinationCityId={destinationCityId}
        date={date}
      />

      <ExploreFilters
        citiesByRegion={citiesByRegion}
        originCityId={originCityId}
        destinationCityId={destinationCityId}
        date={date}
        hasActiveFilter={hasActiveFilter}
        view={view}
      />

      <ExploreMapView posts={posts} isLoggedIn={!!user} emptyMessage={emptyMessage} />

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
