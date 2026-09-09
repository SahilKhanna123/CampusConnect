import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { MarkTripCompleteButton } from "@/components/MarkTripCompleteButton";
import { RegisterInterestForm } from "@/components/RegisterInterestForm";
import { ConnectionRequestButton, type ConnectionStatus } from "@/components/ConnectionRequestButton";
import { ConfirmSeatButton } from "@/components/ConfirmSeatButton";
import { PosterBadge } from "@/components/ExploreCard";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";
import { MarkRequestCompleteButton } from "@/components/MarkRequestCompleteButton";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Deliberately not gated: an unauthenticated visitor gets a read-only
  // preview of a trip's detail page (public browse, per product decision).
  // Every owner-only / account-only section below already branches on
  // isOwner or an explicit `user` check, so a null user naturally falls
  // through to the same read-only view a logged-in non-owner would see,
  // minus the report/block controls and with the interactive buttons
  // replaced by sign-up links.
  const user = await getCurrentUser();

  const { id } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      traveler: { select: { id: true, name: true, photoUrl: true } },
    },
  });
  if (!trip) notFound();

  const isOwner = user ? trip.travelerId === user.id : false;
  // studentsOnly trips are invisible to a non-student, non-owner viewer --
  // 404 rather than a "not allowed" message, matching this app's existing
  // don't-leak-existence idiom for private content (e.g. a Conversation a
  // non-participant hits directly). See the schema comment on
  // Request.studentsOnly for the full enforcement list. An anonymous
  // visitor is treated the same as any other non-student.
  if (trip.studentsOnly && !isOwner && !(user && hasStudentRecord(user))) {
    notFound();
  }
  const initialBlocked =
    isOwner || !user ? false : await isBlockedBetween(user.id, trip.travelerId);
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
  const myConnectionRequest =
    isOwner || !user
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
    connectionRequestStatus === "accepted" && user
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

  // Owner-only: standalone Requests this trip has been matched to via POST
  // /api/requests/[id]/accept -- a separate mechanism from ConnectionRequest
  // (the Participants section above), but drawing from the same
  // seatsRemaining pool, so it's shown here for the same "relevant trip
  // information" reason. Both accepted and completed are shown (history
  // stays visible), same pattern as Participants/ConfirmSeatButton.
  const fulfillingRequests = isOwner
    ? await prisma.request.findMany({
        where: { tripId: trip.id, status: { in: ["accepted", "completed"] } },
        include: {
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
        orderBy: { respondedAt: "asc" },
      })
    : [];

  return (
    <div>
      <div className="detail-header">
        {trip.studentsOnly && <span className="badge-students-only">🎓 Students only</span>}
        <h1 className="heading-tight detail-route-headline">
          {trip.title || "Untitled trip"}
        </h1>
        <p className="detail-route-subtitle">
          {trip.originCity.name}
          {trip.originCity.region ? `, ${trip.originCity.region.name}` : ""} →{" "}
          {destinationLabel}
          {trip.destinationCity?.region ? `, ${trip.destinationCity.region.name}` : ""}
        </p>
        <p className={`trip-status-label trip-status-label-${displayStatus}`}>
          {displayStatus}
        </p>
      </div>
      <p>
        {trip.departureDate.toLocaleDateString()}
        {trip.departureTime && ` at ${trip.departureTime}`}
        {trip.flexibleTime && " (flexible)"}
      </p>
      <p>
        Seats available: {trip.seatsRemaining} / {trip.seatsTotal}
      </p>
      {trip.packageSpaceAvailable && (
        <p>
          Package space available
          {trip.packageCapacityNote && `: ${trip.packageCapacityNote}`}
        </p>
      )}
      {trip.tripNotes && <p>{trip.tripNotes}</p>}
      <p className="detail-poster-row">
        Posted by{" "}
        <Link href={`/profile/${trip.traveler.id}`}>{trip.traveler.name}</Link>
      </p>
      {/* Reporting/blocking inherently requires an account -- there's no
          useful "preview" of either action, so they're simply absent for an
          anonymous viewer rather than linking to sign-up. */}
      {!isOwner && user && (
        <>
          <ReportButton
            reportedUserId={trip.traveler.id}
            contextType="trip"
            contextId={trip.id}
          />{" "}
          <BlockButton
            blockedUserId={trip.traveler.id}
            initialBlocked={initialBlocked}
          />
        </>
      )}

      {isOwner && isUpcoming && (
        <div>
          <Link href={`/trips/${trip.id}/edit`} className="btn-secondary">
            Edit
          </Link>{" "}
          <MarkTripCompleteButton tripId={trip.id} />{" "}
          <DeletePostButton
            deleteUrl={`/api/trips/${trip.id}`}
            redirectTo="/my-posts"
            actionLabel="Cancel Trip"
            confirmMessage="Cancel this trip? Anyone with a pending or accepted connection request will be notified. This can't be undone."
          />
        </div>
      )}

      {/* Shown to the owner regardless of trip status (not just isUpcoming)
          so a completed/cancelled trip's participant history stays visible
          and correctable -- release-seat has no upcoming-only restriction
          for exactly this reason. Only "Add as Participant" itself is
          upcoming-gated, since confirm-seat requires it server-side. */}
      {isOwner && participantRows.length > 0 && (
        <div>
          <h2>Participants</h2>
          <p>
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
        </div>
      )}

      {/* Public roster: anyone viewing the trip can see who's confirmed to
          ride, not just the owner (per product decision) -- read-only, no
          management buttons, and deliberately excludes accepted-but-not-
          yet-confirmed ConnectionRequest candidates (see confirmedRiders'
          own comment above). Also surfaced compactly on /explore and Home
          cards via ExploreCard's confirmedRiderCount. */}
      {!isOwner && confirmedRiders.length > 0 && (
        <div>
          <h2>Riders</h2>
          <div className="trip-participant-list">
            {confirmedRiders.map((row) => (
              <div key={`${row.kind}-${row.id}`} className="trip-participant-row">
                <PosterBadge poster={row.poster} />
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && fulfillingRequests.length > 0 && (
        <div>
          <h2>Requests You&apos;re Fulfilling</h2>
          <div className="trip-participant-list">
            {fulfillingRequests.map((r) => (
              <div key={r.id} className="trip-participant-row">
                <Link href={`/requests/${r.id}`}>
                  <PosterBadge poster={r.postedBy} />
                </Link>
                <span>
                  {r.type === "ride"
                    ? `Ride, ${r.seatsRequested ?? 1} seat(s)`
                    : `Package: ${r.packageDescription ?? ""}`}
                </span>
                {r.status === "accepted" ? (
                  <MarkRequestCompleteButton requestId={r.id} />
                ) : (
                  <span className="seat-confirmed-badge-none">Completed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* An already-accepted connection keeps its "Connected — View
          messages" link even once the trip stops being upcoming (cancelled
          or completed) -- only a FRESH request is blocked, per the "prevent
          new connection requests to inactive trips, but don't hide existing
          connection history" split in the Trip Management spec. */}
      {!isOwner && (connectionRequestStatus === "accepted" || isUpcoming) && (
        <div>
          {user ? (
            <ConnectionRequestButton
              tripId={trip.id}
              initialStatus={connectionRequestStatus}
              conversationId={acceptedConversation?.id}
            />
          ) : (
            // Same label as the real button, but a plain link to sign-up --
            // clicking it takes a logged-out visitor straight there rather
            // than opening the note composer, per product decision.
            <Link href="/sign-up" className="connection-request-button btn-primary">
              Request to Connect
            </Link>
          )}
          {myConnectionRequest?.seatConfirmedAt && (
            <p className="seat-confirmed-badge">
              ✓ You have a confirmed seat on this trip.
            </p>
          )}
        </div>
      )}

      {!isOwner && isUpcoming && (
        <div>
          {trip.seatsRemaining > 0 ? (
            user ? (
              <RegisterInterestForm tripId={trip.id} />
            ) : (
              <Link href="/sign-up" className="connection-request-button btn-secondary">
                Register for a seat
              </Link>
            )
          ) : (
            <p>No seats available right now.</p>
          )}
        </div>
      )}

      {!isOwner && !isUpcoming && connectionRequestStatus !== "accepted" && (
        <p>This trip is no longer accepting connections.</p>
      )}
    </div>
  );
}
