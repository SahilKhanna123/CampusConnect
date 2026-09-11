"use client";

import { PageError } from "@/components/PageError";

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
  return (
    <PageError
      title="Explore"
      message="Something went wrong loading trips. Please try again."
      error={error}
      reset={reset}
    />
  );
}
