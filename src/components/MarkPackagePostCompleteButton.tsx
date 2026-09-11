"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown to the poster on /package-posts/[id] for an open PackagePost --
// POSTs to /api/package-posts/[id]/complete. Mirrors MarkTripCompleteButton
// exactly, just pointed at the PackagePost route.
export function MarkPackagePostCompleteButton({ packagePostId }: { packagePostId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "completing">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    if (!confirm("Mark this post as completed? This can't be undone.")) return;
    setError(null);
    setStatus("completing");

    const res = await fetch(`/api/package-posts/${packagePostId}/complete`, {
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

  return (
    <span>
      <button onClick={handleComplete} disabled={status === "completing"} className="btn-secondary">
        {status === "completing" ? "Marking…" : "Mark Completed"}
      </button>
      {error && <p role="alert">{error}</p>}
    </span>
  );
}
