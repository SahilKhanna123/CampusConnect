import { redirect } from "next/navigation";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { TripPostForm } from "@/components/TripPostForm";
import { FadeIn } from "@/components/FadeIn";

// Create-Trip form -- reached from "Offer a Ride" or "Split an Uber/Lyft"
// on /post, which pre-select Trip.category via ?category=.
export default async function CreateTripPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { category } = await searchParams;
  const isUberShare = category === "uber_share";

  return (
    <div className="form-page">
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Post</span>
        <h1 className="heading-tight">{isUberShare ? "Split an Uber/Lyft" : "Offer a Ride"}</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <TripPostForm
          isStudent={hasStudentRecord(user)}
          initialValues={{
            category: isUberShare ? "uber_share" : "personal_car",
          }}
        />
      </FadeIn>
    </div>
  );
}
