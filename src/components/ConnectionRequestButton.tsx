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
//
// Clicking "Request to Connect" reveals a note composer (same
// reveal-a-form-on-click shape as RegisterInterestForm) rather than firing
// immediately. The note is required -- a plain one-click request with no
// context is no longer possible -- so the trip owner always has something
// to go on before deciding (on /connections and in the connection_request
// notification), and it carries into the chat as the first Message if the
// request is accepted (see POST /api/connection-requests/[id]/accept).
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
  const [composing, setComposing] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/connection-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, message: message.trim() }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setStatus("pending");
    setComposing(false);
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

  if (composing) {
    return (
      <form onSubmit={handleRequest} className="connection-request-compose">
        <label htmlFor={`connection-note-${tripId}`}>
          Tell the trip owner why you&apos;re connecting
        </label>
        <textarea
          id={`connection-note-${tripId}`}
          required
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. I'd need a seat for the return trip too"
        />
        {error && <p role="alert">{error}</p>}
        <div>
          <button type="submit" disabled={loading || !message.trim()}>
            {loading ? "Sending…" : "Send Request"}
          </button>{" "}
          <button
            type="button"
            onClick={() => setComposing(false)}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setComposing(true)}
        className="connection-request-button"
      >
        Request to Connect
      </button>
    </div>
  );
}
