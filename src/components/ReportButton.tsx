"use client";

import { useState } from "react";

const REPORT_REASON_OPTIONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or abusive behavior" },
  { value: "unsafe_behavior", label: "Unsafe behavior" },
  { value: "scam_or_fraud", label: "Scam or fraud" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "other", label: "Other" },
] as const;

// Shared "Report user" control mounted from /profile/[userId], /trips/[id],
// /requests/[id], and /messages/[id] -- each page passes a different
// contextType/contextId pair (see POST /api/reports). Same reveal-on-click
// composer shape as ConnectionRequestButton, but no confirm() dialog:
// submitting isn't destructive to the reporter and has zero automated
// consequence for the reported user (unlike DeletePostButton's confirm()-
// gated actions, which are all irreversible changes to the caller's OWN
// resource). The friction gate here is instead a required reason select
// with no default -- unlike ConnectionRequestButton's fully-optional note,
// you can't submit a report with one click.
export function ReportButton({
  reportedUserId,
  contextType,
  contextId,
}: {
  reportedUserId: string;
  contextType?: "trip" | "request" | "package" | "message" | "profile";
  contextId?: string;
}) {
  const [phase, setPhase] = useState<"idle" | "composing" | "submitted">("idle");
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportedUserId,
        reason,
        detail: detail.trim() || undefined,
        contextType,
        contextId,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setLoading(false);
      return;
    }

    setPhase("submitted");
  }

  if (phase === "submitted") {
    return <p className="report-submitted">Reported. Our team will review this.</p>;
  }

  if (phase === "composing") {
    return (
      <form onSubmit={handleSubmit} className="connection-request-compose">
        <label htmlFor={`report-reason-${reportedUserId}`}>Reason</label>
        <select
          id={`report-reason-${reportedUserId}`}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        >
          <option value="" disabled>
            Select a reason
          </option>
          {REPORT_REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label htmlFor={`report-detail-${reportedUserId}`}>
          Additional detail (optional)
        </label>
        <textarea
          id={`report-detail-${reportedUserId}`}
          maxLength={1000}
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Anything else that would help us understand what happened"
        />
        {error && <p role="alert">{error}</p>}
        <div>
          <button type="submit" disabled={loading || !reason} className="btn-primary">
            {loading ? "Reporting…" : "Submit Report"}
          </button>{" "}
          <button
            type="button"
            onClick={() => {
              setPhase("idle");
              setReason("");
              setDetail("");
              setError(null);
            }}
            disabled={loading}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase("composing")}
      className="report-button btn-secondary"
    >
      Report user
    </button>
  );
}
