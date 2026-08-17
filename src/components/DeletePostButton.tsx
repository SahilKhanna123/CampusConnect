"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shared by Trip and Request detail pages -- DELETE just cancels the post
// (see the DELETE handlers in src/app/api/{trips,requests}/[id]/route.ts),
// it doesn't remove the row.
export function DeletePostButton({
  deleteUrl,
  redirectTo,
}: {
  deleteUrl: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Cancel this post? This can't be undone.")) return;
    setError(null);
    setStatus("deleting");

    const res = await fetch(deleteUrl, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div>
      <button onClick={handleDelete} disabled={status === "deleting"}>
        {status === "deleting" ? "Cancelling…" : "Cancel post"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
