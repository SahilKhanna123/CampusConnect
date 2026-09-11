"use client";

import { useEffect } from "react";

// Shared shell for every route's error.tsx (see PageLoading for the
// equivalent loading-state pattern). error.tsx files are always Client
// Components per Next.js convention, so this is too -- it owns the
// console.error side effect in one place instead of duplicating it per route.
export function PageError({
  title,
  message,
  error,
  reset,
}: {
  title: string;
  message: string;
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="empty-state">
      <span className="eyebrow">{title}</span>
      <p role="alert">{message}</p>
      <div className="empty-state-actions">
        <button className="btn-secondary" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </div>
  );
}
