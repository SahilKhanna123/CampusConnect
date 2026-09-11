import { redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { PackagePostForm } from "@/components/PackagePostForm";

// Create-PackagePost form -- reached from "Offer Package Space" or "Need
// Something Delivered" on /post, pre-selecting PackagePost.kind via
// ?kind=offering_space|needing_delivery.
export default async function CreatePackagePostPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { kind } = await searchParams;
  const citiesByRegion = await getCitiesByRegion();

  return (
    <div>
      <span className="eyebrow">Post</span>
      <h1 className="heading-tight">Package Carrying</h1>
      <PackagePostForm
        citiesByRegion={citiesByRegion}
        isStudent={hasStudentRecord(user)}
        initialValues={{
          kind: kind === "needing_delivery" ? "needing_delivery" : "offering_space",
        }}
      />
    </div>
  );
}
