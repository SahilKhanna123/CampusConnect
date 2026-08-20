"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown to the trip owner in the Participants list on /trips/[id], one per
// accepted ConnectionRequest. Toggles between the two owner-only actions on
// that connection: confirm-seat (turns an accepted connection into an actual
// rider, decrementing Trip.seatsRemaining) and release-seat (undoes that).
// Same confirm-then-fetch-then-router.refresh() shape as MarkTripCompleteButton,
// with the confirm() dialog only on the destructive-ish release path -- adding
// a participant isn't destructive, so it fires immediately like
// ConnectionRequestButton's own "Request to Connect" does.
export function ConfirmSeatButton({
  connectionRequestId,
  seatConfirmed,
  seatsAvailable,
}: {
  connectionRequestId: string;
  seatConfirmed: boolean;
  // Only consulted when !seatConfirmed -- whether the trip has a seat left
  // to give. Passed down rather than re-derived here so every button on the
  // page reflects the same seatsRemaining snapshot the page rendered with.
  seatsAvailable: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (seatConfirmed) {
      if (!confirm("Remove this rider's confirmed seat? This gives the seat back to the trip.")) {
        return;
      }
    }
    setError(null);
    setStatus("working");

    const action = seatConfirmed ? "release-seat" : "confirm-seat";
    const res = await fetch(`/api/connection-requests/${connectionRequestId}/${action}`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setStatus("idle");
    router.refresh();
  }

  if (seatConfirmed) {
    return (
      <span className="confirm-seat-control">
        <span className="seat-confirmed-badge">✓ Confirmed</span>{" "}
        <button type="button" onClick={handleClick} disabled={status === "working"}>
          {status === "working" ? "Removing…" : "Remove"}
        </button>
        {error && <p role="alert">{error}</p>}
      </span>
    );
  }

  return (
    <span className="confirm-seat-control">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "working" || !seatsAvailable}
      >
        {status === "working" ? "Adding…" : "Add as Participant"}
      </button>
      {!seatsAvailable && <span className="seat-confirmed-badge-none"> No seats remaining</span>}
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
