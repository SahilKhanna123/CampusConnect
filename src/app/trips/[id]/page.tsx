import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";

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
    </div>
  );
}
