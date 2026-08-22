"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown next to an otp_verified parent link in the student's own "Linked
// Parents" list on /family -- the student's explicit upgrade to approved
// (full mutual trust), POSTing to /api/family/link/[id]/approve. Not
// destructive, so no confirm() dialog, same as ConnectionRequestButton's
// plain "Request to Connect".
export function ApproveParentLinkButton({ linkId }: { linkId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "approving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
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
      <button type="button" onClick={handleApprove} disabled={status === "approving"}>
        {status === "approving" ? "Approving…" : "Approve connection"}
      </button>
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
