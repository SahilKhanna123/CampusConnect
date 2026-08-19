import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { RegisterInterestForm } from "@/components/RegisterInterestForm";
import { ConnectionRequestButton, type ConnectionStatus } from "@/components/ConnectionRequestButton";

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

  return (
    <div>
      <h1>{trip.title || "Untitled trip"}</h1>
      <p>
        {trip.originCity.name} → {destinationLabel}
      </p>
      <p>Status: {tripDisplayStatus(trip)}</p>
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

      {isOwner && (
        <div>
          <Link href={`/trips/${trip.id}/edit`}>Edit</Link>
          {" · "}
          <DeletePostButton
            deleteUrl={`/api/trips/${trip.id}`}
            redirectTo="/my-posts"
          />
        </div>
      )}

      {!isOwner && tripDisplayStatus(trip) === "active" && (
        <div>
          <ConnectionRequestButton
            tripId={trip.id}
            initialStatus={connectionRequestStatus}
            conversationId={acceptedConversation?.id}
          />
        </div>
      )}

      {!isOwner && tripDisplayStatus(trip) === "active" && (
        <div>
          {trip.seatsRemaining > 0 ? (
            <RegisterInterestForm tripId={trip.id} />
          ) : (
            <p>No seats available right now.</p>
          )}
        </div>
      )}
    </div>
  );
}
