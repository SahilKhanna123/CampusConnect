import { redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { RequestPostForm } from "@/components/RequestPostForm";

// Create-Request form -- reached from "Need a Ride" or "Need to Split an
// Uber" on /post, pre-selecting Request.category via
// ?category=personal_car|uber_share. Package needs live on their own
// /post/package route now (see PackagePostForm.tsx).
export default async function CreateRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { category } = await searchParams;
  const citiesByRegion = await getCitiesByRegion();

  return (
    <div className="form-page">
      <span className="eyebrow">Post</span>
      <h1 className="heading-tight">Post a Request</h1>
      <RequestPostForm
        citiesByRegion={citiesByRegion}
        isStudent={hasStudentRecord(user)}
        initialValues={{
          category: category === "uber_share" ? "uber_share" : "personal_car",
        }}
      />
    </div>
  );
}
