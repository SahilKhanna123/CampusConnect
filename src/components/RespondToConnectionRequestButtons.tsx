"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Accept/Decline for a single pending row on /connections (Received tab).
// Only rendered by the caller when status === "pending".
export function RespondToConnectionRequestButtons({
  connectionRequestId,
}: {
  connectionRequestId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "accepting" | "declining">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<"accepted" | "declined" | null>(null);

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

    setResolved(action === "accept" ? "accepted" : "declined");
    setStatus("idle");
    router.refresh();
  }

  if (resolved) {
    return (
      <p>
        {resolved === "accepted"
          ? "Accepted — you can now message each other."
          : "Declined."}
      </p>
    );
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
