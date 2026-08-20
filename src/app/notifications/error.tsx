"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <h1>Notifications</h1>
      <p role="alert">Something went wrong loading your notifications. Please try again.</p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
