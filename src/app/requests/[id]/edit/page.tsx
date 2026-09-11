import { notFound, redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCitiesByRegion } from "@/lib/geo";
import { RequestPostForm } from "@/components/RequestPostForm";

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const found = await prisma.request.findUnique({ where: { id } });
  if (!found) notFound();
  // Only the Request's own poster can edit it -- redirect anyone else back
  // to the (public) detail view (the API route enforces this too).
  if (found.postedById !== user.id) redirect(`/requests/${id}`);

  const citiesByRegion = await getCitiesByRegion();

  return (
    <div>
      <span className="eyebrow">Edit</span>
      <h1 className="heading-tight">Edit Request</h1>
      <RequestPostForm
        citiesByRegion={citiesByRegion}
        requestId={found.id}
        isStudent={hasStudentRecord(user)}
        initialValues={{
          category: found.category,
          originCityId: found.originCityId ?? "",
          destinationCityId: found.destinationCityId ?? "",
          destinationText: found.destinationText ?? "",
          neededDate: found.neededDate
            ? found.neededDate.toISOString().slice(0, 10)
            : "",
          neededTime: found.neededTime ?? "",
          flexibleTime: found.flexibleTime,
          seatsRequested: found.seatsRequested ?? 1,
          estimatedFarePerSeat: found.estimatedFarePerSeat?.toString() ?? "",
          notes: found.notes ?? "",
          studentsOnly: found.studentsOnly,
        }}
      />
    </div>
  );
}
