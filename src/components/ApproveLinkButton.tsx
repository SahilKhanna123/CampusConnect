"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown on /family to the student, next to any otp_verified ParentStudentLink
// -- POSTs to /api/family/link/[id]/approve. Same confirm()-gated,
// fetch-then-router.refresh() shape as MarkTripCompleteButton -- this is a
// one-way upgrade to full mutual trust, same "can't be undone" framing.
export function ApproveLinkButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "approving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    if (
      !confirm(
        "Approve this connection? This confirms mutual trust with your parent and can't be undone.",
      )
    )
      return;
    setError(null);
    setStatus("approving");

    const res = await fetch(`/api/family/link/${linkId}/approve`, { method: "POST" });
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
      <button onClick={handleApprove} disabled={status === "approving"} className="btn-primary">
        {status === "approving" ? "Approving…" : "Approve"}
      </button>
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
