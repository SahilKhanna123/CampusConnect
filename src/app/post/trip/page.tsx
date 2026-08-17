import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getCitiesByRegion } from "@/lib/geo";
import { TripPostForm } from "@/components/TripPostForm";

// Create-Trip form -- reached from "Offer a Ride" or "Offer Package Space"
// on /post. Both are the same Trip, just pre-checking packageSpaceAvailable
// for the package entry point via ?package=true.
export default async function CreateTripPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { package: packageParam } = await searchParams;
  const citiesByRegion = await getCitiesByRegion();

  return (
    <div>
      <h1>Offer a Ride</h1>
      <TripPostForm
        citiesByRegion={citiesByRegion}
        initialValues={{
          packageSpaceAvailable: packageParam === "true",
        }}
      />
    </div>
  );
}
