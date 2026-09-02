import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getFeaturedRoutePairs } from "@/lib/geo";
import { tripDisplayStatus, requestDisplayStatus } from "@/lib/postStatus";
import { ExploreCard, type ExploreCardPost } from "@/components/ExploreCard";
import type { ConnectionStatus } from "@/components/ConnectionRequestButton";
import { getBlockedCounterpartIds } from "@/lib/blocks";
import { getConfirmedRiderCounts } from "@/lib/tripParticipants";

const LANDING_PREVIEW_LIMIT = 6;

// Home -- the narrow "surfaces the featured corridor prominently" glance
// view (plan doc: Home features the active RouteCommunity by default,
// Explore/search surface trips across any city pair). Ride-only, same
// "package browsing is separate, out of scope" precedent /explore already
// set -- not an oversight. Reuses Explore's exact Trip/Request query shape
// (see src/app/explore/page.tsx) with an added region-pair filter and no
// filter form/pagination; own posts and blocked users are excluded the
// same way.
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
  // Same studentsOnly visibility rule Explore enforces -- see the schema
  // comment on Request.studentsOnly.
  const isStudent = hasStudentRecord(user);
  const studentsOnlyFilter = isStudent ? {} : { studentsOnly: false };

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
        ...studentsOnlyFilter,
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
        ...studentsOnlyFilter,
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
        studentsOnly: trip.studentsOnly,
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
        studentsOnly: r.studentsOnly,
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

  let previewPosts: ExploreCardPost[] = [];

  if (activeRoutes.length > 0) {
    const regionPairFilter = {
      OR: activeRoutes.flatMap(({ regionAId, regionBId }) => [
        { originCity: { regionId: regionAId }, destinationCity: { regionId: regionBId } },
        { originCity: { regionId: regionBId }, destinationCity: { regionId: regionAId } },
      ]),
    };

    // Ride-only and studentsOnly:false, same rules an anonymous /explore
    // viewer already gets (see src/app/explore/page.tsx) -- an anonymous
    // visitor is never a student, and package browsing stays out of scope
    // everywhere in this app. No self-exclusion/blocked-user filtering --
    // there's no viewer identity to exclude.
    const [trips, requests] = await Promise.all([
      prisma.trip.findMany({
        where: { status: "upcoming", studentsOnly: false, ...regionPairFilter },
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
        take: LANDING_PREVIEW_LIMIT,
      }),
      prisma.request.findMany({
        where: {
          type: "ride",
          tripId: null,
          status: "pending",
          studentsOnly: false,
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
        take: LANDING_PREVIEW_LIMIT,
      }),
    ]);

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
          // Irrelevant for a logged-out card (ExploreCard renders a
          // sign-up link instead of the real button when isLoggedIn is
          // false) -- "none" is just a valid placeholder for the type.
          connectionRequestStatus: "none" as ConnectionStatus,
          confirmedRiderCount: confirmedRiderCounts.get(trip.id) ?? 0,
          studentsOnly: trip.studentsOnly,
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
          studentsOnly: r.studentsOnly,
        },
      }));

    previewPosts = [...offerPosts, ...requestPosts]
      .sort((a, b) => {
        if (a.sortDate === null) return 1;
        if (b.sortDate === null) return -1;
        return a.sortDate.getTime() - b.sortDate.getTime();
      })
      .slice(0, LANDING_PREVIEW_LIMIT)
      .map(({ post }) => post);
  }

  return (
    <div>
      <section className="landing-hero">
        <h1>Find your ride. Leave the driving to a friend.</h1>
        <p>
          CampusConnect is a trusted community marketplace connecting
          students, parents, alumni, and travelers moving between a
          student&apos;s home area and college. Post a ride or a package
          delivery, browse what others have posted, and message before you
          commit -- no account needed to look around.
        </p>
        <p>
          <Link href="/sign-up" className="connection-request-button">
            Get started free
          </Link>{" "}
          <Link href="/explore" className="connection-request-button">
            Browse listings
          </Link>
        </p>
      </section>

      <section>
        <h2>Browse listings</h2>
        {previewPosts.length === 0 ? (
          <p>
            <Link href="/explore">See everything on Explore</Link> to browse
            current trips and requests.
          </p>
        ) : (
          <>
            <div className="explore-grid">
              {previewPosts.map((post) => (
                <ExploreCard
                  key={`${post.kind}-${post.id}`}
                  post={post}
                  isLoggedIn={false}
                />
              ))}
            </div>
            <p>
              <Link href="/explore">See everything on Explore</Link>
            </p>
          </>
        )}
      </section>
    </div>
  );
}
