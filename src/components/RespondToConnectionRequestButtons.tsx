"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Accept/Decline for a single pending row on /connections (Received tab).
// Only rendered by the caller when status === "pending". Accepting
// redirects straight to the resulting thread (POST .../accept already
// returns conversationId -- see src/app/api/connection-requests/[id]/accept/route.ts)
// rather than staying on this page; declining stays put with an inline
// confirmation, since there's no thread to jump to.
export function RespondToConnectionRequestButtons({
  connectionRequestId,
}: {
  connectionRequestId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "accepting" | "declining">("idle");
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  async function respond(action: "accept" | "decline") {
    setError(null);
    setStatus(action === "accept" ? "accepting" : "declining");

    const res = await fetch(`/api/connection-requests/${connectionRequestId}/${action}`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    if (action === "accept") {
      const body = await res.json();
      router.push(`/messages/${body.conversationId}`);
      return;
    }

    setDeclined(true);
    setStatus("idle");
    router.refresh();
  }

  if (declined) {
    return <p>Declined.</p>;
  }

  return (
    <div>
      <button onClick={() => respond("accept")} disabled={status !== "idle"}>
        {status === "accepting" ? "Accepting…" : "Accept"}
      </button>{" "}
      <button onClick={() => respond("decline")} disabled={status !== "idle"}>
        {status === "declining" ? "Declining…" : "Decline"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
