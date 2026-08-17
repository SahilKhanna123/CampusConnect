"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Public, no-auth landing page for the "this wasn't me" link in the parent
// connection notice email. Deliberately requires an explicit button click
// before calling the reject API -- never fires automatically on page load.
// Email security scanners are known to pre-fetch links to scan them, which
// would silently reject a legitimate connection if this page acted on GET
// alone (confirmed firsthand elsewhere in this project with a different
// link). Requiring a real click is the whole mitigation.
export default function LinkObjectionPage() {
  return (
    <Suspense fallback={<h1>Remove Parent Connection</h1>}>
      <LinkObjectionContent />
    </Suspense>
  );
}

function LinkObjectionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleReject() {
    if (!token) return;
    setState("submitting");
    setError(null);

    const res = await fetch(`/api/family/link-objection/${token}/reject`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      setState("error");
      return;
    }

    setState("done");
  }

  if (!token) {
    return (
      <div>
        <h1>Remove Parent Connection</h1>
        <p>This link is missing information and can&apos;t be used.</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div>
        <h1>Connection Removed</h1>
        <p>
          That parent connection has been removed. If you create a
          CampusConnect account later using this email, it won&apos;t be
          affected.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1>Remove Parent Connection</h1>
      <p>
        Someone claiming to be a parent/guardian connected with you on
        CampusConnect using this email address. If you don&apos;t recognize
        this or don&apos;t want the connection, click below to remove it. You
        don&apos;t need a CampusConnect account to do this.
      </p>
      {error && <p role="alert">{error}</p>}
      <button onClick={handleReject} disabled={state === "submitting"}>
        {state === "submitting"
          ? "Removing…"
          : "This wasn't me — remove this connection"}
      </button>
    </div>
  );
}
