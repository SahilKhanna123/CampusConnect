"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_MESSAGE = "Hi! I saw your package post -- let's coordinate over DM.";

// The *only* interaction entry point for a PackagePost, per product
// decision ("all conversations about packages should be done in private
// DMs") -- there is no formal request/accept step for a package post at
// all, unlike Trip's ConnectionRequest/SeatOffer machinery. Mirrors
// RegisterInterestForm's reveal-a-textarea-on-click shape exactly, just
// posting { packagePostId, body } instead of { tripId, body }. See
// src/app/api/conversations/route.ts.
export function PackageMessageForm({ packagePostId }: { packagePostId: string }) {
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
      body: JSON.stringify({ packagePostId, body: message }),
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
        Message about this post
      </button>
    );
  }

  return (
    <form onSubmit={handleSend} className="register-interest-form">
      <label htmlFor="package-message">
        Send a message to coordinate
      </label>
      <textarea
        id="package-message"
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
