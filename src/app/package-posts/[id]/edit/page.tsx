import { notFound, redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCitiesByRegion } from "@/lib/geo";
import { PackagePostForm } from "@/components/PackagePostForm";

export default async function EditPackagePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const found = await prisma.packagePost.findUnique({ where: { id } });
  if (!found) notFound();
  if (found.postedById !== user.id) redirect(`/package-posts/${id}`);
  if (found.status !== "open") redirect(`/package-posts/${id}`);

  const citiesByRegion = await getCitiesByRegion();

  return (
    <div className="form-page">
      <span className="eyebrow">Edit</span>
      <h1 className="heading-tight">Edit Package Post</h1>
      <PackagePostForm
        citiesByRegion={citiesByRegion}
        packagePostId={found.id}
        isStudent={hasStudentRecord(user)}
        initialValues={{
          originCityId: found.originCityId,
          destinationCityId: found.destinationCityId ?? "",
          destinationText: found.destinationText ?? "",
          date: found.date ? found.date.toISOString().slice(0, 10) : "",
          time: found.time ?? "",
          flexibleTime: found.flexibleTime,
          notes: found.notes ?? "",
          studentsOnly: found.studentsOnly,
        }}
      />
    </div>
  );
}
