"use client";

import { useEffect } from "react";

// Next.js App Router convention: catches a render-time throw from
// ExplorePage (e.g. a failed Prisma query) and shows a recoverable error
// state instead of crashing the whole app shell. Must be a Client Component.
export default function ExploreError({
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
      <h1>Explore</h1>
      <p role="alert">
        Something went wrong loading trips. Please try again.
      </p>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
