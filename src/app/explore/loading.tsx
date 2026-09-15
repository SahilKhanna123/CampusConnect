import { PageLoading } from "@/components/PageLoading";

// Next.js App Router convention: automatically shown while ExplorePage's
// async Server Component work (Prisma queries) is in flight, on both the
// first load and a filter-form/view-tab navigation. Kept generic (not
// "Loading trips and ride requests…") since this file has no access to the
// `view` query param -- it's a route-level fallback rendered before
// ExplorePage's own searchParams have even resolved -- and the page can now
// default to Packages, not Rides.
export default function ExploreLoading() {
  return <PageLoading title="Explore" message="Loading…" />;
}
