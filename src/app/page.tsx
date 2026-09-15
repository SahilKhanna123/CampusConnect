import Link from "next/link";
import type { TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getFeaturedRoutePairs, getCitiesByRegion } from "@/lib/geo";
import { tripDisplayStatus } from "@/lib/postStatus";
import { ExploreCard, type ExploreCardPost } from "@/components/ExploreCard";
import type { ConnectionStatus } from "@/components/ConnectionRequestButton";
import { getBlockedCounterpartIds } from "@/lib/blocks";
import { getConfirmedRiderCounts } from "@/lib/tripParticipants";
import { PackagePostCard, type PackagePostCardPost } from "@/components/PackagePostCard";

// Per-section caps carrying the 50% package / 30% Uber-share / 10%
// personal-car visual-prominence weighting on Home's preview grid (both
// the signed-in feed and the logged-out LandingPage()) -- see the plan's
// "Reweight UI focus" doc. The weighting is expressed through section
// order, item count, and heading size, not per-card sizing (PackagePostCard
// and ExploreCard render at the same size either way).
const PACKAGE_PREVIEW_LIMIT = 6;
const UBER_PREVIEW_LIMIT = 4;
const TRIP_PREVIEW_LIMIT = 2;

const YOUR_TRIPS_LIMIT = 6;

// "Your Upcoming Trips" on the signed-in Home page -- a personal glance
// section, separate from the featured-route discovery feed below it.
// Combines both ways a trip can be "yours": you're driving it (travelerId),
// or you have a confirmed seat on someone else's (an accepted
// ConnectionRequest or SeatOffer with seatConfirmedAt set -- see the Trip
// Participants/Seat Offers sections of CLAUDE.md). The two sets can never
// overlap, since neither mechanism lets you hold a seat on your own trip.
// Cancelled/completed/expired trips are excluded via tripDisplayStatus, the
// same derived-at-read-time helper every other page uses.
type YourUpcomingTrip = {
  trip: {
    id: string;
    title: string | null;
    status: TripStatus;
    departureDate: Date;
    departureTime: string | null;
    originCity: { name: string };
    destinationCity: { name: string } | null;
    destinationText: string | null;
  };
  role: "driving" | "riding";
};

async function getYourUpcomingTrips(userId: string): Promise<YourUpcomingTrip[]> {
  const tripSelect = {
    id: true,
    title: true,
    status: true,
    departureDate: true,
    departureTime: true,
    originCity: { select: { name: true } },
    destinationCity: { select: { name: true } },
    destinationText: true,
  } as const;

  const [drivingTrips, confirmedConnections, confirmedSeatOffers] = await Promise.all([
    prisma.trip.findMany({
      where: { travelerId: userId, status: "upcoming" },
      select: tripSelect,
    }),
    prisma.connectionRequest.findMany({
      where: { requesterId: userId, seatConfirmedAt: { not: null } },
      select: { tripId: true },
    }),
    prisma.seatOffer.findMany({
      where: { recipientId: userId, seatConfirmedAt: { not: null } },
      select: { tripId: true },
    }),
  ]);

  const ridingTripIds = [
    ...new Set([
      ...confirmedConnections.map((c) => c.tripId),
      ...confirmedSeatOffers.map((s) => s.tripId),
    ]),
  ];
  const ridingTrips =
    ridingTripIds.length > 0
      ? await prisma.trip.findMany({
          where: { id: { in: ridingTripIds }, status: "upcoming" },
          select: tripSelect,
        })
      : [];

  const combined: YourUpcomingTrip[] = [
    ...drivingTrips.map((trip) => ({ trip, role: "driving" as const })),
    ...ridingTrips.map((trip) => ({ trip, role: "riding" as const })),
  ];

  return combined
    .filter(({ trip }) => tripDisplayStatus(trip) === "upcoming")
    .sort((a, b) => a.trip.departureDate.getTime() - b.trip.departureDate.getTime())
    .slice(0, YOUR_TRIPS_LIMIT);
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// A static campus-scene illustration for the signed-in Home hero -- per
// product decision, the moving-dot-along-a-line motif this replaced doesn't
// read as meaningful without a route to anchor it to. Explore's own route
// visualization has since moved on too, from an illustrative hover-linked
// schematic to a real map (see RouteMap.tsx). Colors here are deliberately
// restricted to the approved black/white/blue system (globals.css :root
// tokens) -- no green, since that's reserved for verified/trust badges, not
// decorative art.
function HomeHeroIllustration() {
  return (
    <svg viewBox="0 0 320 240" width="100%" height="100%">
      <ellipse cx="58" cy="34" rx="20" ry="11" fill="#ffffff" />
      <ellipse cx="76" cy="28" rx="14" ry="9" fill="#ffffff" />
      <ellipse cx="250" cy="46" rx="18" ry="10" fill="#ffffff" />

      <rect x="0" y="205" width="320" height="35" fill="#dbe8ff" />
      <line
        x1="0"
        y1="222"
        x2="320"
        y2="222"
        stroke="#ffffff"
        strokeWidth="3"
        strokeDasharray="12 10"
      />

      <rect x="81" y="196" width="4" height="12" fill="#000000" />
      <circle cx="83" cy="185" r="9" fill="#eff6ff" stroke="#1D6FFF" strokeWidth="1.5" />

      <rect x="16" y="118" width="56" height="92" rx="4" fill="#ffffff" stroke="#ebebeb" strokeWidth="1.5" />
      {[0, 1].map((col) =>
        [0, 1, 2, 3].map((row) => (
          <rect
            key={`a-${col}-${row}`}
            x={26 + col * 22}
            y={130 + row * 20}
            width="10"
            height="10"
            fill="#eff6ff"
          />
        )),
      )}

      <polygon points="95,50 132,50 150,20 168,50" fill="#ffffff" stroke="#ebebeb" strokeWidth="1.5" />
      <rect x="95" y="50" width="73" height="160" fill="#ffffff" stroke="#ebebeb" strokeWidth="1.5" />
      <line x1="150" y1="20" x2="150" y2="6" stroke="#000000" strokeWidth="2" />
      <polygon points="150,6 150,16 162,11" fill="#1D6FFF" />
      {[0, 1, 2].map((col) =>
        [0, 1, 2, 3, 4, 5].map((row) => (
          <rect
            key={`b-${col}-${row}`}
            x={104 + col * 20}
            y={64 + row * 20}
            width="10"
            height="10"
            fill="#eff6ff"
          />
        )),
      )}

      <rect x="196" y="94" width="62" height="116" rx="4" fill="#ffffff" stroke="#ebebeb" strokeWidth="1.5" />
      {[0, 1].map((col) =>
        [0, 1, 2, 3].map((row) => (
          <rect
            key={`c-${col}-${row}`}
            x={206 + col * 24}
            y={106 + row * 20}
            width="11"
            height="11"
            fill="#eff6ff"
          />
        )),
      )}

      <path
        d="M178,166 Q225,120 292,62"
        stroke="#1D6FFF"
        strokeWidth="2"
        strokeDasharray="5 5"
        fill="none"
        opacity="0.55"
      />
      <circle cx="292" cy="62" r="7" fill="#1D6FFF" />
      <polygon points="285,68 299,68 292,82" fill="#1D6FFF" />

      <line x1="178" y1="171" x2="178" y2="182" stroke="#1D6FFF" strokeWidth="3" />
      <circle cx="178" cy="165" r="7" fill="#1D6FFF" />
      <path
        d="M150,205 L150,197 Q150,191 158,191 L168,179 L193,179 L201,191 Q206,191 206,197 L206,205 Z"
        fill="#000000"
      />
      <circle cx="162" cy="207" r="7" fill="#000000" />
      <circle cx="162" cy="207" r="2.5" fill="#ffffff" />
      <circle cx="195" cy="207" r="7" fill="#000000" />
      <circle cx="195" cy="207" r="2.5" fill="#ffffff" />

      <rect x="245" y="184" width="6" height="11" rx="2" fill="#000000" />
      <rect x="249" y="180" width="15" height="23" rx="4" fill="#1D6FFF" />
      <circle cx="256" cy="173" r="8" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
      <rect x="250" y="203" width="4" height="13" fill="#000000" />
      <rect x="259" y="203" width="4" height="13" fill="#000000" />
    </svg>
  );
}

// Home -- the narrow "surfaces the featured corridor prominently" glance
// view (plan doc: Home features the active RouteCommunity by default,
// Explore/search surface trips across any city pair). Reuses Explore's
// exact Trip query shape (see src/app/explore/page.tsx) with an added
// region-pair filter and no filter form/pagination; own posts and blocked
// users are excluded the same way.
//
// A logged-out visitor gets LandingPage() instead (see below) -- this used
// to redirect("/login") unconditionally, which CLAUDE.md's own Home Page
// section once described as a real functional gap ("the only page with no
// login gate and no data at all, a pure placeholder"); the fix at the time
// was to close that gap by gating. Reversed by explicit product decision: a
// brand-new visitor should land on an introduction/marketing page, not a
// login form, with a live preview of listings below the fold -- same
// "browse before you sign up" precedent already shipped on /explore and the
// trip/request detail pages, just extended to the entry point itself.
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <LandingPage />;

  const { pairs, isPersonal } = await getFeaturedRoutePairs(user);

  if (pairs.length === 0) {
    return (
      <div className="empty-state">
        <h1 className="heading-tight">No featured route right now</h1>
        <p>We don&apos;t have a featured route configured right now.</p>
        <div className="empty-state-actions">
          <Link href="/explore" className="btn-primary">
            See everything on Explore
          </Link>
          <Link href="/post" className="btn-secondary">
            Post a trip
          </Link>
        </div>
      </div>
    );
  }

  const citiesByRegion = await getCitiesByRegion();
  const blockedUserIds = await getBlockedCounterpartIds(user.id);
  const yourUpcomingTrips = await getYourUpcomingTrips(user.id);
  // Same studentsOnly visibility rule Explore enforces -- see the schema
  // comment on Trip.studentsOnly.
  const isStudent = hasStudentRecord(user);
  const studentsOnlyFilter = isStudent ? {} : { studentsOnly: false };

  const regionPairFilter = {
    OR: pairs.flatMap(({ regionAId, regionBId }) => [
      { originCity: { regionId: regionAId }, destinationCity: { regionId: regionBId } },
      { originCity: { regionId: regionBId }, destinationCity: { regionId: regionAId } },
    ]),
  };

  // Same idea as regionPairFilter, but PackagePost.destinationCityId is
  // nullable (a package's destination can be write-in text only) -- the
  // extra two clauses match a destination-less package by its origin
  // region alone, so it isn't silently excluded from the featured route.
  const packagePairFilter = {
    OR: pairs.flatMap(({ regionAId, regionBId }) => [
      { originCity: { regionId: regionAId }, destinationCity: { regionId: regionBId } },
      { originCity: { regionId: regionBId }, destinationCity: { regionId: regionAId } },
      { originCity: { regionId: regionAId }, destinationCityId: null },
      { originCity: { regionId: regionBId }, destinationCityId: null },
    ]),
  };

  const [trips, packagePosts] = await Promise.all([
    prisma.trip.findMany({
      where: {
        status: "upcoming",
        travelerId: { not: user.id, notIn: blockedUserIds },
        ...studentsOnlyFilter,
        ...regionPairFilter,
      },
      include: {
        originCity: { include: { region: true } },
        destinationCity: { include: { region: true } },
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
    prisma.packagePost.findMany({
      where: {
        status: "open",
        postedById: { not: user.id, notIn: blockedUserIds },
        ...studentsOnlyFilter,
        ...packagePairFilter,
      },
      include: {
        originCity: { include: { region: true } },
        destinationCity: { include: { region: true } },
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

  function tripToCardPost(trip: (typeof trips)[number]): { sortDate: Date | null; post: ExploreCardPost } {
    return {
      sortDate: trip.departureDate,
      post: {
        kind: "offer" as const,
        id: trip.id,
        title: trip.title,
        originName: trip.originCity.name,
        destinationName: trip.destinationCity?.name ?? trip.destinationText ?? "?",
        originRegionName: trip.originCity.region.name,
        destinationRegionName: trip.destinationCity?.region?.name ?? null,
        date: trip.departureDate,
        time: trip.departureTime,
        flexibleTime: trip.flexibleTime,
        seatsTotal: trip.seatsTotal,
        seatsRemaining: trip.seatsRemaining,
        poster: trip.traveler,
        connectionRequestStatus: connectionStatusByTripId.get(trip.id) ?? "none",
        confirmedRiderCount: confirmedRiderCounts.get(trip.id) ?? 0,
        studentsOnly: trip.studentsOnly,
      },
    };
  }

  function packagePostToCardPost(p: (typeof packagePosts)[number]): PackagePostCardPost {
    return {
      id: p.id,
      originName: p.originCity.name,
      destinationName: p.destinationCity?.name ?? p.destinationText ?? "?",
      originRegionName: p.originCity.region.name,
      destinationRegionName: p.destinationCity?.region?.name ?? null,
      date: p.date,
      time: p.time,
      flexibleTime: p.flexibleTime,
      notes: p.notes,
      studentsOnly: p.studentsOnly,
      poster: p.postedBy,
    };
  }

  function byDateAscNullsLast(a: { sortDate: Date | null }, b: { sortDate: Date | null }) {
    if (a.sortDate === null) return 1;
    if (b.sortDate === null) return -1;
    return a.sortDate.getTime() - b.sortDate.getTime();
  }

  const upcomingTrips = trips.filter((trip) => tripDisplayStatus(trip) === "upcoming");

  // 3 weighted, independently-capped buckets carrying the 50% package /
  // 30% Uber-share / 10% personal-car visual-prominence split -- see the
  // per-section caps defined near the top of this file.
  const packagePreviewPosts: PackagePostCardPost[] = packagePosts
    .map((p) => ({ sortDate: p.date, post: packagePostToCardPost(p) }))
    .sort(byDateAscNullsLast)
    .slice(0, PACKAGE_PREVIEW_LIMIT)
    .map(({ post }) => post);

  const uberPreviewPosts: ExploreCardPost[] = upcomingTrips
    .filter((t) => t.category === "uber_share")
    .map(tripToCardPost)
    .sort(byDateAscNullsLast)
    .slice(0, UBER_PREVIEW_LIMIT)
    .map(({ post }) => post);

  const tripPreviewPosts: ExploreCardPost[] = upcomingTrips
    .filter((t) => t.category === "personal_car")
    .map(tripToCardPost)
    .sort(byDateAscNullsLast)
    .slice(0, TRIP_PREVIEW_LIMIT)
    .map(({ post }) => post);

  const routeLabel = pairs
    .map((p) => `${p.regionAName} ↔ ${p.regionBName}`)
    .join(", ");

  // A real, honest count -- not a fabricated trust stat -- of how many of
  // the trips/package posts just fetched above were actually created in
  // the last 7 days. Computed from the raw Prisma rows (which carry
  // createdAt) rather than the normalized card-post shapes, since those
  // deliberately don't carry createdAt.
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const postsThisWeekCount =
    trips.filter((t) => t.createdAt >= weekAgo).length +
    packagePosts.filter((p) => p.createdAt >= weekAgo).length;

  const firstName = user.name.split(" ")[0];

  return (
    <div>
      <section className="landing-hero section-shift-gray home-hero">
        <div>
          <span className="eyebrow">
            {timeOfDayGreeting()}, {firstName}
          </span>
          <h1 className="heading-tight landing-hero-title">Send a package. Share a ride.</h1>
          <p className="landing-hero-subtitle">
            {isPersonal ? "Your route" : "Featured route"}: {routeLabel}. Get a package
            delivered, split an Uber, or catch a ride with verified students and
            travelers heading your way.
          </p>
          <form action="/explore" method="get" className="home-search-bar">
            <select name="originCityId" defaultValue="" className="home-search-field">
              <option value="">From campus or city</option>
              {citiesByRegion.map((region) => (
                <optgroup key={region.regionName} label={region.regionName}>
                  {region.cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              name="destinationCityId"
              defaultValue=""
              className="home-search-field"
            >
              <option value="">To campus or city</option>
              {citiesByRegion.map((region) => (
                <optgroup key={region.regionName} label={region.regionName}>
                  {region.cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <button type="submit" className="btn-primary">
              Search
            </button>
          </form>
          <p className="home-stat-line">
            <span className="home-stat-dot" aria-hidden="true" />
            {postsThisWeekCount} {postsThisWeekCount === 1 ? "post" : "posts"} on{" "}
            {routeLabel} this week
          </p>
        </div>
        <div className="landing-hero-art home-hero-art" aria-hidden="true">
          <HomeHeroIllustration />
        </div>
      </section>

      {yourUpcomingTrips.length > 0 && (
        <section className="section-shift-white home-results">
          <div className="home-results-header">
            <h2 className="heading-tight">Your Upcoming Trips</h2>
            <Link href="/my-posts" className="btn-secondary">
              Manage your posts
            </Link>
          </div>
          <div className="list-section">
            {yourUpcomingTrips.map(({ trip, role }) => (
              <div key={trip.id} className="list-card">
                <div className="list-card-top">
                  <Link href={`/trips/${trip.id}`} className="list-card-title">
                    {trip.originCity.name} →{" "}
                    {trip.destinationCity?.name ?? trip.destinationText}
                  </Link>
                  <span className="trip-status-label trip-status-label-upcoming">
                    {role === "driving" ? "Driving" : "Riding"}
                  </span>
                </div>
                <div className="list-card-meta">
                  {trip.title && `${trip.title} — `}
                  {trip.departureDate.toLocaleDateString()}
                  {trip.departureTime && ` at ${trip.departureTime}`}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section-shift-white home-results">
        <div className="home-results-header">
          <h2 className="heading-tight">Upcoming near you</h2>
          <Link href="/explore" className="btn-secondary">
            See everything on Explore
          </Link>
        </div>

        {packagePreviewPosts.length === 0 &&
        uberPreviewPosts.length === 0 &&
        tripPreviewPosts.length === 0 ? (
          <div className="empty-state">
            <p>Nothing on your route right now.</p>
            <Link href="/post" className="btn-secondary">
              Post a trip
            </Link>
          </div>
        ) : (
          <>
            {packagePreviewPosts.length > 0 && (
              <div className="home-category-section">
                <h2 className="heading-tight">📦 Package Deliveries</h2>
                <div className="explore-grid">
                  {packagePreviewPosts.map((post) => (
                    <PackagePostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            )}

            {uberPreviewPosts.length > 0 && (
              <div className="home-category-section">
                <h3 className="post-hub-panel-title">🚕 Splitting an Uber/Lyft</h3>
                <div className="explore-grid">
                  {uberPreviewPosts.map((post) => (
                    <ExploreCard key={`${post.kind}-${post.id}`} post={post} />
                  ))}
                </div>
              </div>
            )}

            {tripPreviewPosts.length > 0 && (
              <div className="home-category-section">
                <span className="eyebrow">🚗 Individual Rides</span>
                <div className="explore-grid">
                  {tripPreviewPosts.map((post) => (
                    <ExploreCard key={`${post.kind}-${post.id}`} post={post} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// Marketing/introduction page shown at "/" to a logged-out visitor -- hero
// tagline + subheading + two CTAs ("Get started free" -> /sign-up, "Browse
// listings" -> /explore), plus a small live preview grid of real listings
// below the fold so a new visitor sees actual content, not just marketing
// copy, before ever creating an account. Deliberately not styled beyond
// what's already in the shared stylesheet (reusing .explore-grid and
// ExploreCard's own styling) -- per product decision, visual polish is a
// later pass; this is the functional/structural version.
async function LandingPage() {
  // No personal route exists for an anonymous visitor (getFeaturedRoutePairs
  // needs a real CurrentUser to derive one from homeCity/studentRecord), so
  // this always takes the same "active RouteCommunity" fallback that
  // function itself falls back to for a logged-in user with no personal
  // route -- kept as a separate, simpler query here rather than threading a
  // null user through getFeaturedRoutePairs, since the "personal route"
  // half of that function is entirely inapplicable to a signed-out viewer.
  const activeRoutes = await prisma.routeCommunity.findMany({
    where: { active: true },
    include: { regionA: true, regionB: true },
  });

  let packagePreviewPosts: PackagePostCardPost[] = [];
  let uberPreviewPosts: ExploreCardPost[] = [];
  let tripPreviewPosts: ExploreCardPost[] = [];

  if (activeRoutes.length > 0) {
    const regionPairFilter = {
      OR: activeRoutes.flatMap(({ regionAId, regionBId }) => [
        { originCity: { regionId: regionAId }, destinationCity: { regionId: regionBId } },
        { originCity: { regionId: regionBId }, destinationCity: { regionId: regionAId } },
      ]),
    };

    // Same nullable-destination adjustment as the signed-in view's
    // packagePairFilter above -- a package with a write-in-only destination
    // (no linked City) still matches by origin region alone.
    const packagePairFilter = {
      OR: activeRoutes.flatMap(({ regionAId, regionBId }) => [
        { originCity: { regionId: regionAId }, destinationCity: { regionId: regionBId } },
        { originCity: { regionId: regionBId }, destinationCity: { regionId: regionAId } },
        { originCity: { regionId: regionAId }, destinationCityId: null },
        { originCity: { regionId: regionBId }, destinationCityId: null },
      ]),
    };

    // studentsOnly:false, same rule an anonymous /explore viewer already
    // gets (see src/app/explore/page.tsx) -- an anonymous visitor is never
    // a student. No self-exclusion/blocked-user filtering -- there's no
    // viewer identity to exclude.
    const [trips, packagePosts] = await Promise.all([
      prisma.trip.findMany({
        where: { status: "upcoming", studentsOnly: false, ...regionPairFilter },
        include: {
          originCity: { include: { region: true } },
          destinationCity: { include: { region: true } },
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
      prisma.packagePost.findMany({
        where: { status: "open", studentsOnly: false, ...packagePairFilter },
        include: {
          originCity: { include: { region: true } },
          destinationCity: { include: { region: true } },
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

    const confirmedRiderCounts = await getConfirmedRiderCounts(trips.map((t) => t.id));

    function byDateAscNullsLast(a: { sortDate: Date | null }, b: { sortDate: Date | null }) {
      if (a.sortDate === null) return 1;
      if (b.sortDate === null) return -1;
      return a.sortDate.getTime() - b.sortDate.getTime();
    }

    const offerPosts: { sortDate: Date | null; post: ExploreCardPost; category: string }[] = trips
      .filter((trip) => tripDisplayStatus(trip) === "upcoming")
      .map((trip) => ({
        sortDate: trip.departureDate,
        category: trip.category,
        post: {
          kind: "offer" as const,
          id: trip.id,
          title: trip.title,
          originName: trip.originCity.name,
          destinationName: trip.destinationCity?.name ?? trip.destinationText ?? "?",
          originRegionName: trip.originCity.region.name,
          destinationRegionName: trip.destinationCity?.region?.name ?? null,
          date: trip.departureDate,
          time: trip.departureTime,
          flexibleTime: trip.flexibleTime,
          seatsTotal: trip.seatsTotal,
          seatsRemaining: trip.seatsRemaining,
          poster: trip.traveler,
          // Irrelevant for a logged-out card (ExploreCard renders a
          // sign-up link instead of the real button when isLoggedIn is
          // false) -- "none" is just a valid placeholder for the type.
          connectionRequestStatus: "none" as ConnectionStatus,
          confirmedRiderCount: confirmedRiderCounts.get(trip.id) ?? 0,
          studentsOnly: trip.studentsOnly,
        },
      }));

    uberPreviewPosts = offerPosts
      .filter((o) => o.category === "uber_share")
      .sort(byDateAscNullsLast)
      .slice(0, UBER_PREVIEW_LIMIT)
      .map(({ post }) => post);

    tripPreviewPosts = offerPosts
      .filter((o) => o.category === "personal_car")
      .sort(byDateAscNullsLast)
      .slice(0, TRIP_PREVIEW_LIMIT)
      .map(({ post }) => post);

    packagePreviewPosts = packagePosts
      .map((p) => ({
        sortDate: p.date,
        post: {
          id: p.id,
          originName: p.originCity.name,
          destinationName: p.destinationCity?.name ?? p.destinationText ?? "?",
          originRegionName: p.originCity.region.name,
          destinationRegionName: p.destinationCity?.region?.name ?? null,
          date: p.date,
          time: p.time,
          flexibleTime: p.flexibleTime,
          notes: p.notes,
          studentsOnly: p.studentsOnly,
          poster: p.postedBy,
        } satisfies PackagePostCardPost,
      }))
      .sort(byDateAscNullsLast)
      .slice(0, PACKAGE_PREVIEW_LIMIT)
      .map(({ post }) => post);
  }

  return (
    <div>
      <section className="landing-hero section-shift-gray">
        <div>
          <span className="eyebrow">Student travel, made easy</span>
          <h1 className="heading-tight landing-hero-title">
            Send a package. Share a ride.
          </h1>
          <p className="landing-hero-subtitle">
            CampusConnect is a trusted community marketplace connecting
            students, parents, alumni, and travelers moving between a
            student&apos;s home area and college. Post a package delivery,
            split an Uber, or offer a ride, browse what others have posted,
            and message before you commit -- no account needed to look
            around.
          </p>
          <div className="landing-hero-ctas">
            <Link href="/sign-up" className="btn-primary">
              Get started free
            </Link>
            <Link href="/explore" className="btn-secondary">
              Browse listings
            </Link>
          </div>
          <div className="landing-trust-bar">
            <span>
              <span className="badge-verified">
                <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M13.5 4.5 6 12 2.5 8.5l1-1L6 10l6.5-6.5z" />
                </svg>
                Verified
              </span>{" "}
              university emails
            </span>
            <span>No payments, no middlemen</span>
            <span>Message before you commit</span>
          </div>
        </div>
        <div className="landing-hero-art" aria-hidden="true">
          <svg viewBox="0 0 320 240" width="100%" height="100%">
            <circle cx="60" cy="180" r="6" fill="#000000" />
            <circle cx="260" cy="60" r="6" fill="#1D6FFF" />
            <path
              d="M60,180 C140,140 180,100 260,60"
              stroke="#1D6FFF"
              strokeWidth="2"
              fill="none"
            />
            <circle r="4" fill="#1D6FFF">
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                path="M60,180 C140,140 180,100 260,60"
              />
            </circle>
          </svg>
        </div>
      </section>

      <section className="landing-preview-section section-shift-white">
        <div className="home-results-header">
          <h2 className="heading-tight">Browse listings</h2>
          {(packagePreviewPosts.length > 0 ||
            uberPreviewPosts.length > 0 ||
            tripPreviewPosts.length > 0) && (
            <Link href="/explore" className="btn-secondary">
              See everything on Explore
            </Link>
          )}
        </div>
        {packagePreviewPosts.length === 0 &&
        uberPreviewPosts.length === 0 &&
        tripPreviewPosts.length === 0 ? (
          <div className="empty-state">
            <p>Nothing to preview here yet.</p>
            <Link href="/explore" className="btn-secondary">
              See everything on Explore
            </Link>
          </div>
        ) : (
          <>
            {packagePreviewPosts.length > 0 && (
              <div className="home-category-section">
                <h2 className="heading-tight">📦 Package Deliveries</h2>
                <div className="explore-grid">
                  {packagePreviewPosts.map((post) => (
                    <PackagePostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            )}

            {uberPreviewPosts.length > 0 && (
              <div className="home-category-section">
                <h3 className="post-hub-panel-title">🚕 Splitting an Uber/Lyft</h3>
                <div className="explore-grid">
                  {uberPreviewPosts.map((post) => (
                    <ExploreCard
                      key={`${post.kind}-${post.id}`}
                      post={post}
                      isLoggedIn={false}
                    />
                  ))}
                </div>
              </div>
            )}

            {tripPreviewPosts.length > 0 && (
              <div className="home-category-section">
                <span className="eyebrow">🚗 Individual Rides</span>
                <div className="explore-grid">
                  {tripPreviewPosts.map((post) => (
                    <ExploreCard
                      key={`${post.kind}-${post.id}`}
                      post={post}
                      isLoggedIn={false}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
