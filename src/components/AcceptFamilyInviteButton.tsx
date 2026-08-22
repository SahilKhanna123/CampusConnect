"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Deliberately requires an explicit button click before calling the accept
// API -- never fires automatically on page load, same reasoning as
// LinkObjectionPage: email security scanners are known to pre-fetch links,
// and accepting here creates a real, approved-status ParentStudentLink
// (an even stronger trust grant than the objection page's revoke), so an
// auto-acting GET would be worse here, not better.
export function AcceptFamilyInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "accepting" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    setStatus("accepting");

    const res = await fetch("/api/family/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setStatus("done");
    router.push("/family");
  }

  if (status === "done") {
    return <p>Connected. Taking you to your family page…</p>;
  }

  return (
    <div>
      {error && <p role="alert">{error}</p>}
      <button onClick={handleAccept} disabled={status === "accepting"}>
        {status === "accepting" ? "Accepting…" : "Accept the invitation"}
      </button>
    </div>
  );
}
