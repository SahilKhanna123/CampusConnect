"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Marks every one of the caller's unread notifications as read, then
// refreshes the server component so the list re-renders without its state --
// same confirm-free fetch-then-router.refresh() shape as
// CancelConnectionRequestButton, minus the confirm() since this isn't
// destructive.
export function MarkAllNotificationsReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/notifications/read-all", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="mark-all-read-button btn-secondary"
    >
      {loading ? "Marking…" : "Mark all as read"}
    </button>
  );
}
