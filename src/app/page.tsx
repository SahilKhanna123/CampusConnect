import Link from "next/link";
import type { TripStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { tripDisplayStatus } from "@/lib/postStatus";
import { ExploreCard, type ExploreCardPost } from "@/components/ExploreCard";
import type { ConnectionStatus } from "@/components/ConnectionRequestButton";
import { getBlockedCounterpartIds } from "@/lib/blocks";
import { getConfirmedRiderCounts } from "@/lib/tripParticipants";
import { PackagePostCard, type PackagePostCardPost } from "@/components/PackagePostCard";
import { FadeIn } from "@/components/FadeIn";
import { CityAutocomplete } from "@/components/CityAutocomplete";
import { haversineDistanceMiles } from "@/lib/distance";

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

// A USA map illustration for the signed-in Home hero -- replaces an earlier
// campus-skyline scene per direct feedback ("create a map of America and
// add multiple blue curves, from place to place"), matching what the app
// actually offers post-launch: posting from any US city, not just the
// Bay Area <-> UC Irvine corridor. The map itself (public/usa-map.svg) is a
// real, accurate 50-state outline -- CC0/public-domain "Blank US Map
// (states only).svg" by Heitordp on Wikimedia Commons, recolored here (see
// its own <style> block) to this app's cream/blue palette rather than
// hand-drawn, since freehand state borders would only look approximately
// right. `routes` are drawn as a separate SVG overlay on top (rather than
// baked into the map file) so they can stay ordinary React-driven markup;
// coordinates are eyeballed city-ish positions within the map's own
// 959x593 viewBox, not real geocoding. Origin dots stay black, destination
// pins stay blue, mirroring the same two-color route motif already used by
// LandingPage's own hero below and the Explore route map.
const HOME_HERO_ROUTES: { from: [number, number]; to: [number, number] }[] = [
  { from: [95, 220], to: [820, 180] }, // Bay Area -> New York
  { from: [130, 75], to: [570, 195] }, // Seattle -> Chicago
  { from: [140, 290], to: [400, 370] }, // Los Angeles -> Dallas
  { from: [330, 240], to: [660, 340] }, // Denver -> Atlanta
  { from: [570, 195], to: [860, 130] }, // Chicago -> Boston
  { from: [400, 370], to: [740, 520] }, // Dallas -> Miami
];

function homeHeroRoutePath([x1, y1]: [number, number], [x2, y2]: [number, number]): string {
  const midX = (x1 + x2) / 2;
  return `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
}

function HomeHeroIllustration() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static local
          asset, not a next/image candidate anywhere else in this app */}
      <img src="/usa-map.svg" alt="" className="home-hero-map" />
      <svg viewBox="0 0 959 593" className="home-hero-routes" aria-hidden="true">
        {HOME_HERO_ROUTES.map((route, i) => (
          <path
            key={i}
            d={homeHeroRoutePath(route.from, route.to)}
            stroke="#1D6FFF"
            strokeWidth="2"
            strokeDasharray="1 8"
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {HOME_HERO_ROUTES.map((route, i) => (
          <g key={i}>
            <circle cx={route.from[0]} cy={route.from[1]} r="5.5" fill="#000000" />
            <circle cx={route.to[0]} cy={route.to[1]} r="5.5" fill="#1D6FFF" />
          </g>
        ))}
      </svg>
    </>
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

  const blockedUserIds = await getBlockedCounterpartIds(user.id);
  const yourUpcomingTrips = await getYourUpcomingTrips(user.id);
  // Same studentsOnly visibility rule Explore enforces -- see the schema
  // comment on Trip.studentsOnly.
  const isStudent = hasStudentRecord(user);
  const studentsOnlyFilter = isStudent ? {} : { studentsOnly: false };

  // No region-pair filter anymore -- "Upcoming near you" used to be scoped
  // to whatever RouteCommunity matched the viewer's personal or the site's
  // featured corridor (Bay Area <-> UC Irvine at launch). Now that posting
  // works from anywhere, this queries every upcoming Trip/PackagePost and
  // sorts by proximity to the viewer's own home city instead (see
  // byProximityThenDate below), falling back to plain recency when there's
  // no home city or it has no coordinates.
  const [trips, packagePosts] = await Promise.all([
    prisma.trip.findMany({
      where: {
        status: "upcoming",
        travelerId: { not: user.id, notIn: blockedUserIds },
        ...studentsOnlyFilter,
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

  // Proximity-to-home-city sort, replacing the old region-pair filter's
  // job of deciding what counts as "near you". No PostGIS/raw SQL in this
  // codebase (see src/lib/distance.ts), so distance is computed in JS from
  // each post's origin City coordinates against the viewer's home city.
  // Falls back to the existing byDateAscNullsLast recency order when the
  // viewer has no home city, or it has no coordinates -- a post whose own
  // origin lacks coordinates simply sorts to the end rather than erroring.
  const homeCoords =
    user.homeCity?.latitude != null && user.homeCity?.longitude != null
      ? { lat: user.homeCity.latitude, lng: user.homeCity.longitude }
      : null;

  function distanceFromHome(city: { latitude: number | null; longitude: number | null }): number {
    if (!homeCoords || city.latitude == null || city.longitude == null) {
      return Number.POSITIVE_INFINITY;
    }
    return haversineDistanceMiles(homeCoords, { lat: city.latitude, lng: city.longitude });
  }

  function byProximityThenDate<T extends { originCity: { latitude: number | null; longitude: number | null } }>(
    a: { item: T; sortDate: Date | null },
    b: { item: T; sortDate: Date | null },
  ) {
    if (homeCoords) {
      const d = distanceFromHome(a.item.originCity) - distanceFromHome(b.item.originCity);
      if (d !== 0) return d;
    }
    return byDateAscNullsLast(a, b);
  }

  // 3 weighted, independently-capped buckets carrying the 50% package /
  // 30% Uber-share / 10% personal-car visual-prominence split -- see the
  // per-section caps defined near the top of this file.
  const packagePreviewPosts: PackagePostCardPost[] = packagePosts
    .map((p) => ({ item: p, sortDate: p.date, post: packagePostToCardPost(p) }))
    .sort(byProximityThenDate)
    .slice(0, PACKAGE_PREVIEW_LIMIT)
    .map(({ post }) => post);

  const uberPreviewPosts: ExploreCardPost[] = upcomingTrips
    .filter((t) => t.category === "uber_share")
    .map((t) => ({ item: t, ...tripToCardPost(t) }))
    .sort(byProximityThenDate)
    .slice(0, UBER_PREVIEW_LIMIT)
    .map(({ post }) => post);

  const tripPreviewPosts: ExploreCardPost[] = upcomingTrips
    .filter((t) => t.category === "personal_car")
    .map((t) => ({ item: t, ...tripToCardPost(t) }))
    .sort(byProximityThenDate)
    .slice(0, TRIP_PREVIEW_LIMIT)
    .map(({ post }) => post);

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
  const nearYouLabel = user.homeCity ? `Near ${user.homeCity.name}` : "Recent activity";

  return (
    <div>
      <section className="landing-hero section-shift-gray home-hero">
        <div>
          <FadeIn mode="mount" delay={0}>
            <span className="eyebrow">
              {timeOfDayGreeting()}, {firstName}
            </span>
          </FadeIn>
          <FadeIn mode="mount" delay={90}>
            <h1 className="heading-tight landing-hero-title">Send a package. Share a ride.</h1>
          </FadeIn>
          <FadeIn mode="mount" delay={180}>
            <p className="landing-hero-subtitle">
              {user.homeCity ? `Near ${user.homeCity.name}. ` : ""}
              Get a package delivered, split an Uber, or catch a ride with
              verified students and travelers heading your way.
            </p>
          </FadeIn>
          <FadeIn mode="mount" delay={270}>
            <form action="/explore" method="get" className="home-search-bar">
              <CityAutocomplete
                id="home-search-origin"
                name="originCityId"
                value={null}
                placeholder="From campus or city"
              />
              <CityAutocomplete
                id="home-search-destination"
                name="destinationCityId"
                value={null}
                placeholder="To campus or city"
              />
              <button type="submit" className="btn-primary">
                Search
              </button>
            </form>
          </FadeIn>
          <FadeIn mode="mount" delay={360}>
            <p className="home-stat-line">
              <span className="home-stat-dot" aria-hidden="true" />
              {postsThisWeekCount} {postsThisWeekCount === 1 ? "post" : "posts"}{" "}
              {user.homeCity ? `near ${user.homeCity.name}` : "posted"} this week
            </p>
          </FadeIn>
        </div>
        <FadeIn mode="mount" delay={180} className="landing-hero-art home-hero-art">
          <div aria-hidden="true">
            <HomeHeroIllustration />
          </div>
        </FadeIn>
      </section>

      {yourUpcomingTrips.length > 0 && (
        <FadeIn mode="viewport">
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
        </FadeIn>
      )}

      <FadeIn mode="viewport">
        <section className="section-shift-white home-results">
          <div className="home-results-header">
            <h2 className="heading-tight">{nearYouLabel}</h2>
            <Link href="/explore" className="btn-secondary">
              See everything on Explore
            </Link>
          </div>

          {packagePreviewPosts.length === 0 &&
          uberPreviewPosts.length === 0 &&
          tripPreviewPosts.length === 0 ? (
            <div className="empty-state">
              <p>{user.homeCity ? "Nothing nearby right now." : "No recent activity right now."}</p>
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
                      <FadeIn key={post.id} mode="viewport">
                        <PackagePostCard post={post} />
                      </FadeIn>
                    ))}
                  </div>
                </div>
              )}

              {uberPreviewPosts.length > 0 && (
                <div className="home-category-section">
                  <h3 className="post-hub-panel-title">🚕 Splitting an Uber/Lyft</h3>
                  <div className="explore-grid">
                    {uberPreviewPosts.map((post) => (
                      <FadeIn key={`${post.kind}-${post.id}`} mode="viewport">
                        <ExploreCard post={post} />
                      </FadeIn>
                    ))}
                  </div>
                </div>
              )}

              {tripPreviewPosts.length > 0 && (
                <div className="home-category-section">
                  <span className="eyebrow">🚗 Individual Rides</span>
                  <div className="explore-grid">
                    {tripPreviewPosts.map((post) => (
                      <FadeIn key={`${post.kind}-${post.id}`} mode="viewport">
                        <ExploreCard post={post} />
                      </FadeIn>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </FadeIn>
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
  // No user to derive proximity from (or a RouteCommunity to scope to,
  // now that posting works from anywhere) -- always the same "most
  // recent activity site-wide" query the signed-in feed falls back to
  // when the viewer has no home city.
  //
  // studentsOnly:false, same rule an anonymous /explore viewer already
  // gets (see src/app/explore/page.tsx) -- an anonymous visitor is never
  // a student. No self-exclusion/blocked-user filtering -- there's no
  // viewer identity to exclude.
  const [trips, packagePosts] = await Promise.all([
    prisma.trip.findMany({
      where: { status: "upcoming", studentsOnly: false },
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
      where: { status: "open", studentsOnly: false },
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

  const uberPreviewPosts: ExploreCardPost[] = offerPosts
    .filter((o) => o.category === "uber_share")
    .sort(byDateAscNullsLast)
    .slice(0, UBER_PREVIEW_LIMIT)
    .map(({ post }) => post);

  const tripPreviewPosts: ExploreCardPost[] = offerPosts
    .filter((o) => o.category === "personal_car")
    .sort(byDateAscNullsLast)
    .slice(0, TRIP_PREVIEW_LIMIT)
    .map(({ post }) => post);

  const packagePreviewPosts: PackagePostCardPost[] = packagePosts
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

  return (
    <div>
      <section className="landing-hero section-shift-gray">
        <div>
          <FadeIn mode="mount" delay={0}>
            <span className="eyebrow">Student travel, made easy</span>
          </FadeIn>
          <FadeIn mode="mount" delay={90}>
            <h1 className="heading-tight landing-hero-title">
              Send a package. Share a ride.
            </h1>
          </FadeIn>
          <FadeIn mode="mount" delay={180}>
            <p className="landing-hero-subtitle">
              CampusConnect is a trusted community marketplace connecting
              students, parents, alumni, and travelers moving between a
              student&apos;s home area and college. Post a package delivery,
              split an Uber, or offer a ride, browse what others have posted,
              and message before you commit -- no account needed to look
              around.
            </p>
          </FadeIn>
          <FadeIn mode="mount" delay={270}>
            <div className="landing-hero-ctas">
              <Link href="/sign-up" className="btn-primary">
                Get started free
              </Link>
              <Link href="/explore" className="btn-secondary">
                Browse listings
              </Link>
            </div>
          </FadeIn>
          <FadeIn mode="mount" delay={360} className="landing-trust-bar">
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
          </FadeIn>
        </div>
        <FadeIn mode="mount" delay={180} className="landing-hero-art">
          <svg viewBox="0 0 320 240" width="100%" height="100%" aria-hidden="true">
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
        </FadeIn>
      </section>

      <FadeIn mode="viewport">
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
                      <FadeIn key={post.id} mode="viewport">
                        <PackagePostCard post={post} />
                      </FadeIn>
                    ))}
                  </div>
                </div>
              )}

              {uberPreviewPosts.length > 0 && (
                <div className="home-category-section">
                  <h3 className="post-hub-panel-title">🚕 Splitting an Uber/Lyft</h3>
                  <div className="explore-grid">
                    {uberPreviewPosts.map((post) => (
                      <FadeIn key={`${post.kind}-${post.id}`} mode="viewport">
                        <ExploreCard post={post} isLoggedIn={false} />
                      </FadeIn>
                    ))}
                  </div>
                </div>
              )}

              {tripPreviewPosts.length > 0 && (
                <div className="home-category-section">
                  <span className="eyebrow">🚗 Individual Rides</span>
                  <div className="explore-grid">
                    {tripPreviewPosts.map((post) => (
                      <FadeIn key={`${post.kind}-${post.id}`} mode="viewport">
                        <ExploreCard post={post} isLoggedIn={false} />
                      </FadeIn>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </FadeIn>
    </div>
  );
}
