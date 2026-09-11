import { PageLoading } from "@/components/PageLoading";

// Next.js App Router convention: app-wide fallback shown while any route
// without its own loading.tsx is doing async server work.
export default function RootLoading() {
  return <PageLoading title="Loading" message="Loading…" />;
}
