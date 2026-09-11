import { PageLoading } from "@/components/PageLoading";

// Next.js App Router convention: automatically shown while ExplorePage's
// async Server Component work (Prisma queries) is in flight, on both the
// first load and a filter-form navigation.
export default function ExploreLoading() {
  return <PageLoading title="Explore" message="Loading trips and ride requests…" />;
}
