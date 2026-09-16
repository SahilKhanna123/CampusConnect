import { notFound, redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PackagePostForm } from "@/components/PackagePostForm";
import { FadeIn } from "@/components/FadeIn";

export default async function EditPackagePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const found = await prisma.packagePost.findUnique({
    where: { id },
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
    },
  });
  if (!found) notFound();
  if (found.postedById !== user.id) redirect(`/package-posts/${id}`);
  if (found.status !== "open") redirect(`/package-posts/${id}`);

  return (
    <div className="form-page">
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Edit</span>
        <h1 className="heading-tight">Edit Package Post</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <PackagePostForm
          packagePostId={found.id}
          isStudent={hasStudentRecord(user)}
          initialOriginCity={{
            id: found.originCity.id,
            name: found.originCity.name,
            regionName: found.originCity.region.name,
          }}
          initialDestinationCity={
            found.destinationCity
              ? {
                  id: found.destinationCity.id,
                  name: found.destinationCity.name,
                  regionName: found.destinationCity.region.name,
                }
              : null
          }
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
      </FadeIn>
    </div>
  );
}
