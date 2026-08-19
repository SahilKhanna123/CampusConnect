"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Cancel for a single pending row on /connections (Sent tab). Same
// confirm+fetch+redirect-free-refresh convention as DeletePostButton.
export function CancelConnectionRequestButton({
  connectionRequestId,
}: {
  connectionRequestId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "cancelling">("idle");
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  async function handleCancel() {
    if (!confirm("Cancel this connection request?")) return;
    setError(null);
    setStatus("cancelling");

    const res = await fetch(`/api/connection-requests/${connectionRequestId}/cancel`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setCancelled(true);
    setStatus("idle");
    router.refresh();
  }

  if (cancelled) return <p>Cancelled.</p>;

  return (
    <div>
      <button onClick={handleCancel} disabled={status === "cancelling"}>
        {status === "cancelling" ? "Cancelling…" : "Cancel request"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
