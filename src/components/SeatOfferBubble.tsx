"use client";

import { useState } from "react";

export type SeatOfferData = {
  id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  recipientId: string;
  createdAt: string; // pre-serialized ISO, same convention as Message.sentAt
  respondedAt: string | null;
  seatConfirmedAt: string | null;
};

// Renders one SeatOffer as an inline bubble in the message thread (see
// MessageThread), positioned chronologically among the real messages by
// createdAt -- clickable in the sense that its own Accept/Decline/Cancel/
// Remove buttons live right in the bubble, not behind a separate control
// above the thread. Owner and recipient see different actions depending on
// status; a resolved (declined/cancelled) offer, or one being viewed by
// neither party, is a plain read-only historical bubble.
export function SeatOfferBubble({
  offer,
  currentUserId,
  isOwner,
  onUpdate,
}: {
  offer: SeatOfferData;
  currentUserId: string;
  isOwner: boolean;
  onUpdate: (patch: Partial<SeatOfferData> & { id: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRecipient = offer.recipientId === currentUserId;

  async function act(
    action: "accept" | "decline" | "cancel" | "release-seat",
    patch: Partial<SeatOfferData>,
  ) {
    if (
      action === "release-seat" &&
      !confirm("Remove this rider's confirmed seat? This gives the seat back to the trip.")
    ) {
      return;
    }
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/seat-offers/${offer.id}/${action}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    onUpdate({ id: offer.id, ...patch });
    setLoading(false);
  }

  let statusText: string;
  let actions: React.ReactNode = null;
  const now = () => new Date().toISOString();

  if (offer.status === "pending") {
    if (isOwner) {
      statusText = "💺 Seat request sent";
      actions = (
        <button
          type="button"
          onClick={() => act("cancel", { status: "cancelled", respondedAt: now() })}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? "Cancelling…" : "Cancel"}
        </button>
      );
    } else if (isRecipient) {
      statusText = "💺 You have a seat request for this trip";
      actions = (
        <>
          <button
            type="button"
            onClick={() =>
              act("accept", {
                status: "accepted",
                respondedAt: now(),
                seatConfirmedAt: now(),
              })
            }
            disabled={loading}
            className="btn-primary"
          >
            {loading ? "Accepting…" : "Accept seat"}
          </button>{" "}
          <button
            type="button"
            onClick={() => act("decline", { status: "declined", respondedAt: now() })}
            disabled={loading}
            className="btn-secondary"
          >
            {loading ? "Declining…" : "Decline"}
          </button>
        </>
      );
    } else {
      statusText = "💺 Seat request pending";
    }
  } else if (offer.status === "accepted") {
    statusText = offer.seatConfirmedAt
      ? "💺 Seat request accepted"
      : "💺 Seat request accepted (seat later removed)";
    if (isOwner && offer.seatConfirmedAt) {
      actions = (
        <button
          type="button"
          onClick={() => act("release-seat", { seatConfirmedAt: null })}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? "Removing…" : "Remove"}
        </button>
      );
    }
  } else if (offer.status === "declined") {
    statusText = "💺 Seat request declined";
  } else {
    statusText = "💺 Seat request cancelled";
  }

  return (
    <li className="seat-offer-bubble">
      <div className="seat-offer-bubble-text">
        {statusText}
        {offer.status === "accepted" && offer.seatConfirmedAt && (
          <>
            {" "}
            <span className="seat-confirmed-badge">✓</span>
          </>
        )}
      </div>
      {actions && <div className="seat-offer-bubble-actions">{actions}</div>}
      {error && <p role="alert">{error}</p>}
      <div className="message-meta">{new Date(offer.createdAt).toLocaleString()}</div>
    </li>
  );
}
