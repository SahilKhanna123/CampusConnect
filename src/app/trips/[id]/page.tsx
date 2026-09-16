import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { MarkTripCompleteButton } from "@/components/MarkTripCompleteButton";
import { RegisterInterestForm } from "@/components/RegisterInterestForm";
import { ConnectionRequestButton, type ConnectionStatus } from "@/components/ConnectionRequestButton";
import { ConfirmSeatButton } from "@/components/ConfirmSeatButton";
import { PosterBadge, PosterAvatar, formatYearLabel, shortenUniversityName } from "@/components/ExploreCard";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";
import { FadeIn } from "@/components/FadeIn";

// Small flat-line icons for the trip-fact-list rows -- same thin-stroke,
// currentColor style as the app's other inline icons (RouteArrow in
// ExploreCard.tsx, the native select/date-input glyphs in globals.css).
// CalendarIcon's path is the same one used for the date input's own
// picker glyph, so the two read as the same icon wherever they appear.
function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="trip-fact-icon" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="2" y1="6.5" x2="14" y2="6.5" stroke="currentColor" strokeWidth="1.4" />
      <line x1="5.25" y1="1.25" x2="5.25" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="10.75" y1="1.25" x2="10.75" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SeatsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="trip-fact-icon" aria-hidden="true">
      <circle cx="5.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1.5 14c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11.5" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M9.3 8.4c.6-.3 1.4-.5 2.2-.5 2 0 3.5 1.5 3.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function FareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="trip-fact-icon" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 4.5v7M10 6.2c0-.9-.9-1.6-2-1.6s-2 .7-2 1.6.9 1.4 2 1.6c1.1.2 2 .7 2 1.6s-.9 1.6-2 1.6-2-.7-2-1.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="trip-fact-icon" aria-hidden="true">
      <path
        d="M8 14.5S13 9.8 13 6a5 5 0 1 0-10 0c0 3.8 5 8.5 5 8.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="6" r="1.75" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="trip-fact-icon" aria-hidden="true">
      <path d="M2 3.5h12v7H6.5L3.5 13v-2.5H2v-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.4" />
      <line x1="8" y1="7" x2="8" y2="11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="4.75" r="0.9" fill="currentColor" />
    </svg>
  );
}

// Decorative, illustrative route banner (not geographically accurate) --
// same restricted black/white/blue palette as HomeHeroIllustration in
// src/app/page.tsx, drawn as a tight horizontal strip rather than that
// component's big square hero art. Everything -- road, pins, car, and the
// two labels -- lives inside one SVG viewBox instead of an SVG plus a
// separately-positioned label row, so the labels sit directly under their
// own pins rather than floating at the box's outer edges. No green (see
// HomeHeroIllustration's own comment for why).
function TripRouteBanner({
  originName,
  destinationName,
}: {
  originName: string;
  destinationName: string;
}) {
  return (
    <div className="trip-route-banner">
      <svg viewBox="0 0 600 90" width="100%" height="90" aria-hidden="true">
        <line
          x1="60"
          y1="46"
          x2="540"
          y2="46"
          stroke="#94a3b8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="1 10"
        />

        <g transform="translate(300,46)">
          <rect x="-24" y="-19" width="48" height="15" rx="5" fill="#1D6FFF" />
          <rect x="-12" y="-31" width="24" height="12" rx="4" fill="#1D6FFF" />
          <circle cx="-16" cy="-7" r="7" fill="#000000" />
          <circle cx="-16" cy="-7" r="2.5" fill="#ffffff" />
          <circle cx="16" cy="-7" r="7" fill="#000000" />
          <circle cx="16" cy="-7" r="2.5" fill="#ffffff" />
        </g>

        <circle cx="110" cy="46" r="7" fill="#000000" />
        <circle cx="110" cy="46" r="2.5" fill="#ffffff" />
        <circle cx="490" cy="46" r="7" fill="#000000" />
        <circle cx="490" cy="46" r="2.5" fill="#ffffff" />

        <text x="110" y="80" textAnchor="middle" fontSize="15" fontWeight="700" fill="#000000">
          {originName}
        </text>
        <text x="490" y="80" textAnchor="middle" fontSize="15" fontWeight="700" fill="#000000">
          {destinationName}
        </text>
      </svg>
    </div>
  );
}

function tripKindLabel(category: "personal_car" | "uber_share"): string {
  return category === "uber_share" ? "Splitting an Uber/Lyft" : "Offering a ride";
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Gated, unlike /explore's own card grid (which stays a public preview
  // by product decision) -- a logged-out visitor who clicks into a specific
  // trip's full details is sent straight to sign-up instead of seeing them.
  const user = await getCurrentUser();
  if (!user) redirect("/sign-up");

  const { id } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      traveler: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          signedUpAsParent: true,
          year: true,
          major: true,
          travelPreferences: true,
          homeCity: { select: { name: true } },
          studentRecord: {
            select: { universityDomain: { select: { universityName: true } } },
          },
          verifications: {
            where: { status: "verified" },
            select: { type: true, status: true },
          },
        },
      },
    },
  });
  if (!trip) notFound();

  // Real, non-fabricated poster stats for the sidebar card -- same
  // completed-trip count Explore's own resolvePosterStats computes (see
  // explore/page.tsx), just a single-id count here rather than a batched
  // groupBy since this page only ever needs it for one poster.
  const posterCompletedTripCount = await prisma.trip.count({
    where: { travelerId: trip.travelerId, status: "completed" },
  });
  const posterUniversityVerified = trip.traveler.verifications.some((v) => v.type === "university");
  const posterParentVerified = trip.traveler.verifications.some((v) => v.type === "parent_relationship");
  const posterUniversityName = trip.traveler.studentRecord?.universityDomain?.universityName
    ? shortenUniversityName(trip.traveler.studentRecord.universityDomain.universityName)
    : null;

  const isOwner = trip.travelerId === user.id;
  // studentsOnly trips are invisible to a non-student, non-owner viewer --
  // 404 rather than a "not allowed" message, matching this app's existing
  // don't-leak-existence idiom for private content (e.g. a Conversation a
  // non-participant hits directly). See the schema comment on
  // Trip.studentsOnly for the full enforcement list.
  if (trip.studentsOnly && !isOwner && !hasStudentRecord(user)) {
    notFound();
  }
  const initialBlocked = isOwner ? false : await isBlockedBetween(user.id, trip.travelerId);
  const destinationLabel = trip.destinationCity?.name ?? trip.destinationText;
  const displayStatus = tripDisplayStatus(trip);
  // "upcoming" is the only editable/cancellable/completable state -- an
  // "expired" trip (upcoming in the DB but past its date) still counts as
  // not-upcoming here on purpose, same as everywhere else that gates on
  // this (POST /api/connection-requests, POST /api/conversations, the
  // accept route) -- see src/lib/postStatus.ts.
  const isUpcoming = displayStatus === "upcoming";

  // Only queried for non-owners -- the latest ConnectionRequest (if any)
  // decides the button state; see the "revert to actionable after
  // declined/cancelled" reasoning on ConnectionRequestButton.
  const myConnectionRequest = isOwner
    ? null
    : await prisma.connectionRequest.findFirst({
        where: { tripId: trip.id, requesterId: user.id },
        orderBy: { createdAt: "desc" },
      });
  const connectionRequestStatus: ConnectionStatus =
    (myConnectionRequest?.status as ConnectionStatus) ?? "none";
  // Only fetched when accepted -- a single detail page can afford this
  // extra query; Explore's card grid deliberately skips it (see
  // ConnectionRequestButton's conversationId comment).
  const acceptedConversation =
    connectionRequestStatus === "accepted"
      ? await prisma.conversation.findFirst({
          where: {
            tripId: trip.id,
            AND: [
              { participants: { some: { userId: user.id } } },
              { participants: { some: { userId: trip.travelerId } } },
            ],
          },
        })
      : null;

  // Fetched for everyone, not just the owner: non-owners need the confirmed
  // subset (see confirmedRiders below) for the public "who's riding"
  // roster, while the owner also uses the full list (confirmed-seat or
  // not) as their management picker -- see the Trip Participants section
  // of CLAUDE.md for why this reuses ConnectionRequest rather than a
  // general "add any user" search (there's no user directory in this app,
  // and everyone here has already gone through Request to Connect ->
  // Accept for this specific trip).
  const acceptedConnections = await prisma.connectionRequest.findMany({
    where: { tripId: trip.id, status: "accepted" },
    include: {
      requester: {
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
    orderBy: { createdAt: "asc" },
  });

  // Every accepted SeatOffer for this trip -- the owner-initiated
  // counterpart to the ConnectionRequest roster above (see the Seat Offers
  // section of CLAUDE.md). Only ever confirmed rows are fetched here:
  // unlike ConnectionRequest, accepting a SeatOffer already confirms the
  // seat in the same step, so there's no "accepted but not yet added"
  // intermediate state for this kind to show.
  const acceptedSeatOffers = await prisma.seatOffer.findMany({
    where: { tripId: trip.id, seatConfirmedAt: { not: null } },
    include: {
      recipient: {
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
    orderBy: { seatConfirmedAt: "asc" },
  });

  // One unified roster for the Participants section -- from the owner's
  // point of view it's just "who's riding," regardless of which mechanism
  // (Request to Connect -> Accept -> Add as Participant, or an
  // owner-initiated seat offer) got them there.
  const participantRows = [
    ...acceptedConnections.map((c) => ({
      id: c.id,
      kind: "connection" as const,
      poster: c.requester,
      seatConfirmedAt: c.seatConfirmedAt,
    })),
    ...acceptedSeatOffers.map((s) => ({
      id: s.id,
      kind: "seatOffer" as const,
      poster: s.recipient,
      seatConfirmedAt: s.seatConfirmedAt,
    })),
  ];
  // Public subset of the roster above: anyone viewing the trip (not just
  // the owner) can see who's actually confirmed to ride -- deliberately
  // narrower than the owner's own participantRows, which also includes
  // accepted-but-not-yet-confirmed ConnectionRequest candidates (a private
  // in-progress management detail, not a public fact about the trip).
  const confirmedRiders = participantRows.filter((row) => row.seatConfirmedAt);

  // Real, non-fabricated sidebar "about" line -- derived only from fields
  // that actually exist on User (year/major/travelPreferences), never
  // invented copy. A 4-digit year reads as "Class of 'YY"; any other free
  // text (e.g. "Junior") is shown as-is, same convention formatYearLabel
  // already applies to the "UC Irvine '26" card stats line.
  const yearMajorParts: string[] = [];
  if (trip.traveler.year) {
    yearMajorParts.push(
      /^(19|20)\d{2}$/.test(trip.traveler.year)
        ? `Class of ${formatYearLabel(trip.traveler.year)}`
        : trip.traveler.year,
    );
  }
  if (trip.traveler.major) {
    yearMajorParts.push(
      yearMajorParts.length > 0 ? `studying ${trip.traveler.major}` : `Studying ${trip.traveler.major}`,
    );
  }
  const yearMajorLine = yearMajorParts.length > 0 ? yearMajorParts.join(" ") : null;

  const paymentNoticeText =
    trip.category === "uber_share"
      ? "Riders and the driver work out the fare directly. CampusConnect doesn't process payments."
      : "Riders and drivers work out gas money directly. CampusConnect doesn't process payments.";

  return (
    <div className="trip-detail-layout">
      <div>
        <Link href="/explore" className="detail-back-link">
          ← Back to Explore
        </Link>

        <FadeIn mode="mount" delay={0}>
          <div>
            <span className="explore-card-kind explore-card-kind-offer">
              {tripKindLabel(trip.category)}
            </span>
            {trip.studentsOnly && (
              <span className="badge-students-only" style={{ marginLeft: 8 }}>
                🎓 Students only
              </span>
            )}
            <h1 className="heading-tight detail-route-headline">
              {trip.title || "Untitled trip"}
            </h1>
            <p className="detail-route-subtitle">
              {trip.originCity.name}
              {trip.originCity.region ? `, ${trip.originCity.region.name}` : ""} →{" "}
              {destinationLabel}
              {trip.destinationCity?.region ? `, ${trip.destinationCity.region.name}` : ""}
            </p>
            <span className={`trip-status-pill trip-status-pill-${displayStatus}`}>
              {displayStatus}
            </span>
          </div>
        </FadeIn>

        <FadeIn mode="mount" delay={90}>
          <TripRouteBanner
            originName={trip.originCity.name}
            destinationName={destinationLabel ?? "?"}
          />
        </FadeIn>

        <FadeIn mode="mount" delay={180}>
          <div className="detail-card trip-fact-card">
            <div className="trip-fact-row">
              <CalendarIcon />
              <div>
                <div className="trip-fact-primary">
                  {trip.departureDate.toLocaleDateString()}
                  {trip.departureTime && ` at ${trip.departureTime}`}
                </div>
                {trip.flexibleTime && <div className="trip-fact-secondary">Time is flexible</div>}
              </div>
            </div>
            <div className="trip-fact-row">
              <SeatsIcon />
              <div>
                <div className="trip-fact-primary">
                  {trip.seatsRemaining} of {trip.seatsTotal} seat
                  {trip.seatsTotal === 1 ? "" : "s"} available
                </div>
                {confirmedRiders.length > 0 && (
                  <div className="trip-fact-secondary">
                    {confirmedRiders.length} rider{confirmedRiders.length === 1 ? "" : "s"} already
                    confirmed
                  </div>
                )}
              </div>
            </div>
            {/* "Splitting an Uber/Lyft" itself is already conveyed by the
                kind pill above the title -- these two rows only add what
                that pill doesn't: the actual fare and meeting point. */}
            {trip.category === "uber_share" && trip.estimatedFarePerSeat && (
              <div className="trip-fact-row">
                <FareIcon />
                <div className="trip-fact-primary">{`~$${trip.estimatedFarePerSeat} per seat`}</div>
              </div>
            )}
            {trip.category === "uber_share" && trip.meetingPoint && (
              <div className="trip-fact-row">
                <PinIcon />
                <div className="trip-fact-primary">Meet at: {trip.meetingPoint}</div>
              </div>
            )}
            {trip.tripNotes && (
              <div className="trip-fact-row">
                <NoteIcon />
                <div className="trip-fact-primary">{trip.tripNotes}</div>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Shown to the owner regardless of trip status (not just
            isUpcoming) so a completed/cancelled trip's participant history
            stays visible and correctable -- release-seat has no
            upcoming-only restriction for exactly this reason. Only "Add as
            Participant" itself is upcoming-gated, since confirm-seat
            requires it server-side. */}
        {isOwner && participantRows.length > 0 && (
          <FadeIn mode="viewport">
            <section className="profile-section">
              <h2 className="profile-section-title">Participants</h2>
              <p className="profile-section-hint">
                {trip.seatsRemaining} of {trip.seatsTotal} seat
                {trip.seatsTotal === 1 ? "" : "s"} still open
              </p>
              <div className="trip-participant-list">
                {participantRows.map((row) => (
                  <div key={`${row.kind}-${row.id}`} className="trip-participant-row">
                    <PosterBadge poster={row.poster} />
                    {isUpcoming || row.seatConfirmedAt ? (
                      <ConfirmSeatButton
                        id={row.id}
                        kind={row.kind}
                        seatConfirmed={!!row.seatConfirmedAt}
                        seatsAvailable={trip.seatsRemaining > 0}
                      />
                    ) : (
                      <span className="seat-confirmed-badge-none">Not confirmed</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </FadeIn>
        )}

        {/* Public roster: anyone viewing the trip can see who's confirmed
            to ride, not just the owner (per product decision) -- read-only,
            no management buttons, and deliberately excludes
            accepted-but-not-yet-confirmed ConnectionRequest candidates (see
            confirmedRiders' own comment above). Also surfaced compactly on
            /explore and Home cards via ExploreCard's confirmedRiderCount. */}
        {!isOwner && confirmedRiders.length > 0 && (
          <FadeIn mode="viewport">
            <div>
              <h2 className="profile-section-title">Riders on this trip</h2>
              <div className="detail-card rider-chip-list">
                {confirmedRiders.map((row) => (
                  <div key={`${row.kind}-${row.id}`} className="rider-chip">
                    <PosterBadge poster={row.poster} />
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </div>

      <div className="trip-sidebar">
        <FadeIn mode="mount" delay={90}>
          <div className="detail-card">
            <div className="sidebar-poster-top">
              <PosterAvatar poster={trip.traveler} size={56} className="sidebar-poster-avatar" />
              <div>
                <div className="sidebar-poster-name">{trip.traveler.name}</div>
                <div className="sidebar-poster-role">
                  {trip.traveler.signedUpAsParent ? "Parent" : "Student"}
                  {posterUniversityName && `, ${posterUniversityName}`}
                </div>
              </div>
            </div>

            {(posterUniversityVerified || posterParentVerified) && (
              <div className="sidebar-poster-badges">
                {posterUniversityVerified && (
                  <span className="badge-verified">
                    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M13.5 4.5 6 12 2.5 8.5l1-1L6 10l6.5-6.5z" />
                    </svg>
                    University verified
                  </span>
                )}
                {posterParentVerified && (
                  <span className="badge-verified">
                    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M13.5 4.5 6 12 2.5 8.5l1-1L6 10l6.5-6.5z" />
                    </svg>
                    Parent verified
                  </span>
                )}
              </div>
            )}

            {(yearMajorLine || trip.traveler.travelPreferences) && (
              <p className="sidebar-poster-bio">
                {yearMajorLine}
                {yearMajorLine && trip.traveler.travelPreferences && ". "}
                {trip.traveler.travelPreferences}
              </p>
            )}

            <p className="sidebar-poster-stats">
              {posterCompletedTripCount} completed trip{posterCompletedTripCount === 1 ? "" : "s"}
              {trip.traveler.homeCity && `. Lives in ${trip.traveler.homeCity.name}.`}
            </p>

            <div className="sidebar-poster-actions">
              {isOwner ? (
                isUpcoming && (
                  <>
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
                  </>
                )
              ) : (
                <>
                  {/* An already-accepted connection keeps its "Connected —
                      View messages" link even once the trip stops being
                      upcoming (cancelled or completed) -- only a FRESH
                      request is blocked, per the "prevent new connection
                      requests to inactive trips, but don't hide existing
                      connection history" split in the Trip Management
                      spec. */}
                  {(connectionRequestStatus === "accepted" || isUpcoming) && (
                    <ConnectionRequestButton
                      tripId={trip.id}
                      initialStatus={connectionRequestStatus}
                      conversationId={acceptedConversation?.id}
                    />
                  )}
                  {myConnectionRequest?.seatConfirmedAt && (
                    <p className="seat-confirmed-badge">
                      ✓ You have a confirmed seat on this trip.
                    </p>
                  )}
                  {isUpcoming &&
                    (trip.seatsRemaining > 0 ? (
                      <RegisterInterestForm tripId={trip.id} />
                    ) : (
                      <p>No seats available right now.</p>
                    ))}
                  {!isUpcoming && connectionRequestStatus !== "accepted" && (
                    <p>This trip is no longer accepting connections.</p>
                  )}
                  <Link href={`/profile/${trip.traveler.id}`} className="btn-secondary">
                    View full profile
                  </Link>
                </>
              )}
            </div>
          </div>
        </FadeIn>

        {!isOwner && (
          <FadeIn mode="viewport" className="button-row">
            <ReportButton
              reportedUserId={trip.traveler.id}
              contextType="trip"
              contextId={trip.id}
            />
            <BlockButton
              blockedUserId={trip.traveler.id}
              initialBlocked={initialBlocked}
            />
          </FadeIn>
        )}

        {!isOwner && (
          <FadeIn mode="viewport">
            <div className="chat-safety-notice">
              <InfoIcon />
              <span>{paymentNoticeText}</span>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
