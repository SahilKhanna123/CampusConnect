"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type FulfillableTrip = {
  id: string;
  title: string | null;
  originCityName: string;
  destinationName: string;
  departureDate: string; // pre-serialized ISO, same convention as MessageThread's Message.sentAt
};

// Shown to a non-owner viewer of a standalone (tripId=null), still-pending
// Request who has at least one of their own eligible upcoming Trips (see
// the caller in requests/[id]/page.tsx for the eligibility filtering).
// Picking a trip and submitting attaches it via POST /api/requests/[id]/accept
// -- the transactional capacity guard there is authoritative even if this
// picker's snapshot (fetched at page load) has since gone stale.
export function FulfillRequestForm({
  requestId,
  trips,
}: {
  requestId: string;
  trips: FulfillableTrip[];
}) {
  const router = useRouter();
  const [tripId, setTripId] = useState(trips[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tripId) return;
    setError(null);
    setStatus("sending");

    const res = await fetch(`/api/requests/${requestId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId }),
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

  return (
    <form onSubmit={handleSubmit} className="fulfill-request-form">
      <label htmlFor={`fulfill-trip-${requestId}`}>Offer to fulfill with one of your trips</label>
      <select
        id={`fulfill-trip-${requestId}`}
        value={tripId}
        onChange={(e) => setTripId(e.target.value)}
      >
        {trips.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title || "Untitled trip"}: {t.originCityName} → {t.destinationName} —{" "}
            {new Date(t.departureDate).toLocaleDateString()}
          </option>
        ))}
      </select>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === "sending" || !tripId}>
        {status === "sending" ? "Offering…" : "Offer This Trip"}
      </button>
    </form>
  );
}
