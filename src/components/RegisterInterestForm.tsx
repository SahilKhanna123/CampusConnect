"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_MESSAGE = "Hi! I'd like to register for a seat on this trip.";

// Shown to non-owner viewers on /trips/[id] for an actionable Trip with a
// seat left (see the caller in trips/[id]/page.tsx). Starts/reuses a
// Conversation with the trip's traveler and sends the first message -- the
// plan doc's "message the traveler before committing to a formal request"
// flow, not a seat reservation: this never touches Trip.seatsRemaining. See
// src/app/api/conversations/route.ts.
export function RegisterInterestForm({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("sending");

    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, body: message }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    const body = await res.json();
    router.push(`/messages/${body.conversationId}`);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary">
        Register for a seat
      </button>
    );
  }

  return (
    <form onSubmit={handleSend} className="register-interest-form">
      <label htmlFor="register-message">
        Send a message to the traveler to register your interest
      </label>
      <textarea
        id="register-message"
        required
        maxLength={2000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <div>
        <button type="submit" disabled={status === "sending"} className="btn-primary">
          {status === "sending" ? "Sending…" : "Send message"}
        </button>{" "}
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={status === "sending"}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
