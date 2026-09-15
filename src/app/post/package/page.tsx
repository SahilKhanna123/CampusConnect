import { redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { PackagePostForm } from "@/components/PackagePostForm";

// Create-PackagePost form -- reached from "Offer Package Space" on /post.
export default async function CreatePackagePostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const citiesByRegion = await getCitiesByRegion();

  return (
    <div className="form-page">
      <span className="eyebrow">Post</span>
      <h1 className="heading-tight">Package Carrying</h1>
      <PackagePostForm
        citiesByRegion={citiesByRegion}
        isStudent={hasStudentRecord(user)}
      />
    </div>
  );
}
