import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCitiesByRegion } from "@/lib/geo";
import { tripDisplayStatus } from "@/lib/postStatus";
import { TripPostForm } from "@/components/TripPostForm";

export default async function EditTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip) notFound();
  // Only the Trip's own traveler can edit it -- redirect anyone else back
  // to the (public) detail view rather than exposing an edit form they
  // can't submit successfully anyway (the API route enforces this too).
  if (trip.travelerId !== user.id) redirect(`/trips/${id}`);
  // Same reasoning as the PATCH route's own guard -- redirect here too so a
  // direct link to this URL for a completed/cancelled trip doesn't show a
  // form that will just 400 on submit.
  if (tripDisplayStatus(trip) !== "upcoming") redirect(`/trips/${id}`);

  const citiesByRegion = await getCitiesByRegion();

  return (
    <div>
      <h1>Edit Trip</h1>
      <TripPostForm
        citiesByRegion={citiesByRegion}
        tripId={trip.id}
        initialValues={{
          title: trip.title ?? "",
          originCityId: trip.originCityId,
          destinationCityId: trip.destinationCityId ?? "",
          destinationText: trip.destinationText ?? "",
          departureDate: trip.departureDate.toISOString().slice(0, 10),
          departureTime: trip.departureTime ?? "",
          flexibleTime: trip.flexibleTime,
          seatsTotal: trip.seatsTotal,
          packageSpaceAvailable: trip.packageSpaceAvailable,
          packageCapacityNote: trip.packageCapacityNote ?? "",
          tripNotes: trip.tripNotes ?? "",
        }}
      />
    </div>
  );
}
