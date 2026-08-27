"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Near-identical clone of MarkTripCompleteButton -- usable by either
// participant on an accepted Request (the poster, or the trip owner who
// accepted it), so it's mounted from three places (/requests/[id],
// /trips/[id]'s "Requests You're Fulfilling" section, and /my-posts), all
// POSTing to the same route.
export function MarkRequestCompleteButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "completing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    if (!confirm("Mark this request as completed? This can't be undone.")) return;
    setError(null);
    setStatus("completing");

    const res = await fetch(`/api/requests/${requestId}/complete`, { method: "POST" });
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
