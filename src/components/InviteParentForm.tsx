"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The student-initiated direction on /family: invite a parent/guardian by
// email. Distinct from ConnectStudentClient's parent-initiated OTP flow --
// this sends straight to the parent's own inbox (no code, no proving
// access to anything), since the student is the one vouching here. On
// success, stays on the page and refreshes so the new pending invite shows
// up in the Sent Invites list below (see /family/page.tsx).
export function InviteParentForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/family/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentEmail: email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setEmail("");
    setStatus("sent");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="app-form">
      <div>
        <label htmlFor="parentEmail">Parent/guardian&apos;s email</label>
        <input
          id="parentEmail"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus("idle");
          }}
        />
      </div>
      {error && <p role="alert">{error}</p>}
      {status === "sent" && <p>Invite sent.</p>}
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Send Invite"}
      </button>
    </form>
  );
}
