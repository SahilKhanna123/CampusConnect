// Next.js App Router convention: automatically shown while ExplorePage's
// async Server Component work (Prisma queries) is in flight, on both the
// first load and a filter-form navigation.
export default function ExploreLoading() {
  return (
    <div>
      <h1>Explore</h1>
      <p>Loading trips and ride requests…</p>
    </div>
  );
}
