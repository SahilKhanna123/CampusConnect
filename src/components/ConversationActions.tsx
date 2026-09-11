"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Archive/Unarchive + Delete controls for one row on /messages -- sits in
// the sibling .conversation-item-actions region alongside the row's own
// .conversation-item-link (the row can't just be one big <a> once it needs
// interactive buttons too, same restructuring ExploreCard already went
// through for ConnectionRequestButton). router.refresh() after any action
// re-runs the server component's query, which naturally drops the row from
// whichever tab it's no longer eligible for (archived/deleted) or moves it
// into the other (unarchived).
export function ConversationActions({
  conversationId,
  initialArchived,
}: {
  conversationId: string;
  initialArchived: boolean;
}) {
  const router = useRouter();
  const [archived, setArchived] = useState(initialArchived);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchiveToggle() {
    setError(null);
    setLoading(true);

    const res = await fetch(
      `/api/conversations/${conversationId}/${archived ? "unarchive" : "archive"}`,
      { method: "POST" },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setArchived((prev) => !prev);
    setLoading(false);
    router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        "Delete this conversation? It will disappear from your Messages list -- if the other person sends a new message, it'll come back.",
      )
    ) {
      return;
    }
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.refresh();
  }

  return (
    <div className="conversation-item-actions button-row">
      <button
        type="button"
        onClick={handleArchiveToggle}
        disabled={loading}
        className="btn-secondary"
      >
        {archived ? "Unarchive" : "Archive"}
      </button>
      <button type="button" onClick={handleDelete} disabled={loading} className="btn-secondary">
        Delete
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
