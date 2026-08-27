"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Shown on /requests/[id] once a request is completed, to whichever
// participant hasn't yet reviewed the other -- always-visible (no
// reveal-on-click, unlike ReportButton/ConnectionRequestButton), since it
// only ever renders in this one narrow, already-gated state, so there's no
// clutter to hide behind a click. No confirm() dialog -- not destructive to
// the caller's own resource, same reasoning ReportButton uses to skip one.
export function ReviewForm({
  requestId,
  revieweeName,
}: {
  requestId: string;
  revieweeName: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return;
    setError(null);
    setStatus("sending");

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        rating: Number(rating),
        comment: comment.trim() || undefined,
      }),
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
    <form onSubmit={handleSubmit} className="review-form">
      <label htmlFor={`review-rating-${requestId}`}>Rate {revieweeName}</label>
      <select
        id={`review-rating-${requestId}`}
        required
        value={rating}
        onChange={(e) => setRating(e.target.value)}
      >
        <option value="" disabled>
          Select a rating
        </option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} star{n === 1 ? "" : "s"}
          </option>
        ))}
      </select>
      <label htmlFor={`review-comment-${requestId}`}>Comment (optional)</label>
      <textarea
        id={`review-comment-${requestId}`}
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How did it go?"
      />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === "sending" || !rating}>
        {status === "sending" ? "Submitting…" : "Submit Review"}
      </button>
    </form>
  );
}
