"use client";

import { useState } from "react";

// Shared "Block user" control, mounted alongside ReportButton from the same
// four places (/profile/[userId], /trips/[id], /package-posts/[id],
// /messages/[id]) -- each server component computes `initialBlocked` via
// isBlockedBetween (src/lib/blocks.ts) so this renders in the right state
// (Block vs. Unblock) without a client-side fetch. Unlike ReportButton,
// blocking has a real, visible effect (hides each other from Explore, stops
// new conversations/connection requests), so it's confirm()-gated like
// DeletePostButton's irreversible actions -- except blocking IS reversible,
// so the copy explains that rather than warning "this can't be undone."
export function BlockButton({
  blockedUserId,
  initialBlocked,
}: {
  blockedUserId: string;
  initialBlocked: boolean;
}) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = blocked
      ? confirm(
          "Unblock this user? You'll be able to see each other's posts again, and message or send connection requests again.",
        )
      : confirm(
          "Block this user? You won't see each other's trips or requests in Explore, and neither of you will be able to start a new conversation or connection request. You can unblock them later.",
        );
    if (!confirmed) return;

    setError(null);
    setLoading(true);

    const res = blocked
      ? await fetch(`/api/blocks/${blockedUserId}`, { method: "DELETE" })
      : await fetch("/api/blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockedId: blockedUserId }),
        });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setBlocked((prev) => !prev);
    setLoading(false);
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="block-button btn-secondary"
      >
        {loading ? "…" : blocked ? "Unblock user" : "Block user"}
      </button>
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
