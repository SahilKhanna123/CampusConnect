"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown to the owner on /trips/[id] (and inline in the Upcoming list on
// /my-posts) for an upcoming Trip -- POSTs to /api/trips/[id]/complete.
// Stays on the current page and refreshes rather than redirecting (unlike
// DeletePostButton's redirect-to-/my-posts), since seeing the trip's own
// status flip to "completed" in place is the useful confirmation here.
export function MarkTripCompleteButton({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "completing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    if (!confirm("Mark this trip as completed? This can't be undone.")) return;
    setError(null);
    setStatus("completing");

    const res = await fetch(`/api/trips/${tripId}/complete`, { method: "POST" });
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
    <span>
      <button onClick={handleComplete} disabled={status === "completing"}>
        {status === "completing" ? "Marking…" : "Mark Completed"}
      </button>
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
