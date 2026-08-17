import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCitiesByRegion } from "@/lib/geo";
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

  const citiesByRegion = await getCitiesByRegion();

  return (
    <div>
      <h1>Edit Trip</h1>
      <TripPostForm
        citiesByRegion={citiesByRegion}
        tripId={trip.id}
        initialValues={{
          originCityId: trip.originCityId,
          destinationCityId: trip.destinationCityId,
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
