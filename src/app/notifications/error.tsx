"use client";

import { PageError } from "@/components/PageError";

// Next.js App Router convention (see src/app/explore/error.tsx): catches a
// render-time throw from NotificationsPage (e.g. a failed Prisma query) and
// shows a recoverable error state instead of crashing the whole app shell.
export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError
      title="Notifications"
      message="Something went wrong loading your notifications. Please try again."
      error={error}
      reset={reset}
    />
  );
}
