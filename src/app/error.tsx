"use client";

import { PageError } from "@/components/PageError";

// Next.js App Router convention: app-wide fallback for a render-time throw
// in any route without its own error.tsx. Must be a Client Component.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageError
      title="Error"
      message="Something went wrong. Please try again."
      error={error}
      reset={reset}
    />
  );
}
