import { PageLoading } from "@/components/PageLoading";

// Next.js App Router convention (see src/app/explore/loading.tsx): shown
// automatically while NotificationsPage's async Prisma query is in flight.
export default function NotificationsLoading() {
  return <PageLoading title="Notifications" message="Loading notifications…" />;
}
