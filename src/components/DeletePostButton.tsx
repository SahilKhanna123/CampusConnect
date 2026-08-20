"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shared by Trip and Request detail pages -- DELETE just cancels the post
// (see the DELETE handlers in src/app/api/{trips,requests}/[id]/route.ts),
// it doesn't remove the row. actionLabel/confirmMessage default to the
// original generic Request-cancel copy; the Trip detail page overrides both
// with trip-specific wording (mentioning that connected users get notified).
export function DeletePostButton({
  deleteUrl,
  redirectTo,
  actionLabel = "Cancel post",
  confirmMessage = "Cancel this post? This can't be undone.",
}: {
  deleteUrl: string;
  redirectTo: string;
  actionLabel?: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(confirmMessage)) return;
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
        {status === "deleting" ? "Cancelling…" : actionLabel}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
