// Next.js App Router convention (see src/app/explore/loading.tsx): shown
// automatically while NotificationsPage's async Prisma query is in flight.
export default function NotificationsLoading() {
  return (
    <div>
      <h1>Notifications</h1>
      <p>Loading notifications…</p>
    </div>
  );
}
