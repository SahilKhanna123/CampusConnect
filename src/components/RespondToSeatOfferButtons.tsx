"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown to the recipient in a message thread (/messages/[id]) while a
// SeatOffer sent to them is still pending -- same Accept/Decline shape as
// RespondToConnectionRequestButtons on /connections.
export function RespondToSeatOfferButtons({ seatOfferId }: { seatOfferId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    setError(null);
    setLoading(action);

    const res = await fetch(`/api/seat-offers/${seatOfferId}/${action}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(null);
      return;
    }

    setLoading(null);
    router.refresh();
  }

  return (
    <span className="confirm-seat-control">
      <button type="button" onClick={() => respond("accept")} disabled={loading !== null}>
        {loading === "accept" ? "Accepting…" : "Accept seat"}
      </button>{" "}
      <button type="button" onClick={() => respond("decline")} disabled={loading !== null}>
        {loading === "decline" ? "Declining…" : "Decline"}
      </button>
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
