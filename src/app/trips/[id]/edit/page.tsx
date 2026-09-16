import { notFound, redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tripDisplayStatus } from "@/lib/postStatus";
import { TripPostForm } from "@/components/TripPostForm";
import { FadeIn } from "@/components/FadeIn";

export default async function EditTripPage({
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
    },
  });
  if (!trip) notFound();
  // Only the Trip's own traveler can edit it -- redirect anyone else back
  // to the (public) detail view rather than exposing an edit form they
  // can't submit successfully anyway (the API route enforces this too).
  if (trip.travelerId !== user.id) redirect(`/trips/${id}`);
  // Same reasoning as the PATCH route's own guard -- redirect here too so a
  // direct link to this URL for a completed/cancelled trip doesn't show a
  // form that will just 400 on submit.
  if (tripDisplayStatus(trip) !== "upcoming") redirect(`/trips/${id}`);

  return (
    <div className="form-page">
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Edit</span>
        <h1 className="heading-tight">Edit Trip</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <TripPostForm
          tripId={trip.id}
          isStudent={hasStudentRecord(user)}
          initialOriginCity={{
            id: trip.originCity.id,
            name: trip.originCity.name,
            regionName: trip.originCity.region.name,
          }}
          initialDestinationCity={
            trip.destinationCity
              ? {
                  id: trip.destinationCity.id,
                  name: trip.destinationCity.name,
                  regionName: trip.destinationCity.region.name,
                }
              : null
          }
          initialValues={{
            title: trip.title ?? "",
            category: trip.category,
            originCityId: trip.originCityId,
            destinationCityId: trip.destinationCityId ?? "",
            destinationText: trip.destinationText ?? "",
            departureDate: trip.departureDate.toISOString().slice(0, 10),
            departureTime: trip.departureTime ?? "",
            flexibleTime: trip.flexibleTime,
            seatsTotal: trip.seatsTotal,
            estimatedFarePerSeat: trip.estimatedFarePerSeat?.toString() ?? "",
            meetingPoint: trip.meetingPoint ?? "",
            tripNotes: trip.tripNotes ?? "",
            studentsOnly: trip.studentsOnly,
          }}
        />
      </FadeIn>
    </div>
  );
}
