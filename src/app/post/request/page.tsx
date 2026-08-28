import { redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { RequestPostForm } from "@/components/RequestPostForm";

// Create-Request form -- reached from "Need a Ride" or "Need Something
// Delivered" on /post, pre-selecting Request.type via ?type=ride|package.
export default async function CreateRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { type } = await searchParams;
  const citiesByRegion = await getCitiesByRegion();

  return (
    <div>
      <h1>Post a Request</h1>
      <RequestPostForm
        citiesByRegion={citiesByRegion}
        isStudent={hasStudentRecord(user)}
        initialValues={{
          type: type === "package" ? "package" : "ride",
        }}
      />
    </div>
  );
}
