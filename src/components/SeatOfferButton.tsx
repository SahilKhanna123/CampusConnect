"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type SeatOfferStatus = "none" | "pending" | "accepted" | "declined" | "cancelled";

// Shown to the trip owner in a message thread (/messages/[id]) about their
// own trip -- lets them send the recipient of that conversation a seat
// offer directly, no separate note/composer needed (unlike
// ConnectionRequestButton's required note -- this is owner-initiated within
// an already-established chat, not a cold ask from a stranger). One click,
// same immediate-fire shape as "Request to Connect" itself. Reverts to
// sendable again after a decline/cancel, same convention as
// ConnectionRequestButton.
export function SeatOfferButton({
  conversationId,
  initialStatus,
  initialSeatOfferId,
  seatsAvailable,
}: {
  conversationId: string;
  initialStatus: SeatOfferStatus;
  initialSeatOfferId?: string;
  seatsAvailable: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SeatOfferStatus>(initialStatus);
  const [seatOfferId, setSeatOfferId] = useState(initialSeatOfferId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    setLoading(true);

    const res = await fetch("/api/seat-offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    const body = await res.json();
    setSeatOfferId(body.seatOfferId);
    setStatus("pending");
    setLoading(false);
    router.refresh();
  }

  async function handleCancel() {
    if (!seatOfferId) return;
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/seat-offers/${seatOfferId}/cancel`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setStatus("cancelled");
    setLoading(false);
    router.refresh();
  }

  async function handleRemove() {
    if (!seatOfferId) return;
    if (!confirm("Remove this rider's confirmed seat? This gives the seat back to the trip.")) {
      return;
    }
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/seat-offers/${seatOfferId}/release-seat`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setStatus("cancelled");
    setLoading(false);
    router.refresh();
  }

  if (status === "accepted") {
    return (
      <span className="confirm-seat-control">
        <span className="seat-confirmed-badge">✓ Confirmed for a seat</span>{" "}
        <button type="button" onClick={handleRemove} disabled={loading}>
          {loading ? "Removing…" : "Remove"}
        </button>
        {error && <p role="alert">{error}</p>}
      </span>
    );
  }

  if (status === "pending") {
    return (
      <span className="confirm-seat-control">
        <span>Seat request sent</span>{" "}
        <button type="button" onClick={handleCancel} disabled={loading}>
          {loading ? "Cancelling…" : "Cancel"}
        </button>
        {error && <p role="alert">{error}</p>}
      </span>
    );
  }

  return (
    <span className="confirm-seat-control">
      <button type="button" onClick={handleSend} disabled={loading || !seatsAvailable}>
        {loading ? "Sending…" : "Send Seat Request"}
      </button>
      {!seatsAvailable && <span className="seat-confirmed-badge-none"> No seats remaining</span>}
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
