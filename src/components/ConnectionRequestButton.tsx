"use client";

import { useState } from "react";

export type ConnectionStatus = "none" | "pending" | "accepted" | "declined" | "cancelled";

// Shown on /trips/[id] and on each offer ExploreCard for non-owner viewers
// of an actionable trip. The button only ever reflects "is there a LIVE
// (pending or accepted) request" -- a declined/cancelled request reverts to
// the plain "Request to Connect" state so a fresh attempt is always
// possible (the historical declined/cancelled status is what /connections's
// Sent tab is for, not this button). See POST /api/connection-requests for
// the server-side duplicate-pending check this mirrors.
export function ConnectionRequestButton({
  tripId,
  initialStatus,
  conversationId,
}: {
  tripId: string;
  initialStatus: ConnectionStatus;
  // Only meaningful when initialStatus is "accepted" -- lets the trip
  // detail page (which can afford one extra query) link straight to the
  // thread. Explore cards omit this to avoid an N+1 query per card; a
  // "Connected" viewer can still find the thread from /messages.
  conversationId?: string | null;
}) {
  const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/connection-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setStatus("pending");
    setLoading(false);
  }

  if (status === "accepted") {
    return conversationId ? (
      <a href={`/messages/${conversationId}`} className="connection-status connection-status-accepted">
        Connected — View messages
      </a>
    ) : (
      <span className="connection-status connection-status-accepted">Connected</span>
    );
  }

  if (status === "pending") {
    return <span className="connection-status connection-status-pending">Request Sent</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRequest}
        disabled={loading}
        className="connection-request-button"
      >
        {loading ? "Sending…" : "Request to Connect"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
