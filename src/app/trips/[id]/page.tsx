import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { MarkTripCompleteButton } from "@/components/MarkTripCompleteButton";
import { RegisterInterestForm } from "@/components/RegisterInterestForm";
import { ConnectionRequestButton, type ConnectionStatus } from "@/components/ConnectionRequestButton";
import { ConfirmSeatButton } from "@/components/ConfirmSeatButton";
import { PosterBadge } from "@/components/ExploreCard";
import { ReportButton } from "@/components/ReportButton";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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

  const isOwner = trip.travelerId === user.id;
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

  // Owner-only: every accepted connection for this trip, confirmed-seat or
  // not, is the roster the owner picks participants from -- see the Trip
  // Participants section of CLAUDE.md for why this reuses ConnectionRequest
  // rather than a general "add any user" search (there's no user directory
  // in this app, and everyone here has already gone through Request to
  // Connect -> Accept for this specific trip).
  const acceptedConnections = isOwner
    ? await prisma.connectionRequest.findMany({
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
      })
    : [];

  return (
    <div>
      <h1>{trip.title || "Untitled trip"}</h1>
      <p>
        {trip.originCity.name} → {destinationLabel}
      </p>
      <p>Status: {displayStatus}</p>
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
      <p>
        Posted by{" "}
        <Link href={`/profile/${trip.traveler.id}`}>{trip.traveler.name}</Link>
      </p>
      {!isOwner && (
        <ReportButton
          reportedUserId={trip.traveler.id}
          contextType="trip"
          contextId={trip.id}
        />
      )}

      {isOwner && isUpcoming && (
        <div>
          <Link href={`/trips/${trip.id}/edit`}>Edit</Link>
          {" · "}
          <MarkTripCompleteButton tripId={trip.id} />
          {" · "}
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
      {isOwner && acceptedConnections.length > 0 && (
        <div>
          <h2>Participants</h2>
          <p>
            {trip.seatsRemaining} of {trip.seatsTotal} seat
            {trip.seatsTotal === 1 ? "" : "s"} still open
          </p>
          <div className="trip-participant-list">
            {acceptedConnections.map((c) => (
              <div key={c.id} className="trip-participant-row">
                <PosterBadge poster={c.requester} />
                {isUpcoming || c.seatConfirmedAt ? (
                  <ConfirmSeatButton
                    connectionRequestId={c.id}
                    seatConfirmed={!!c.seatConfirmedAt}
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

      {/* An already-accepted connection keeps its "Connected — View
          messages" link even once the trip stops being upcoming (cancelled
          or completed) -- only a FRESH request is blocked, per the "prevent
          new connection requests to inactive trips, but don't hide existing
          connection history" split in the Trip Management spec. */}
      {!isOwner && (connectionRequestStatus === "accepted" || isUpcoming) && (
        <div>
          <ConnectionRequestButton
            tripId={trip.id}
            initialStatus={connectionRequestStatus}
            conversationId={acceptedConversation?.id}
          />
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
            <RegisterInterestForm tripId={trip.id} />
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
