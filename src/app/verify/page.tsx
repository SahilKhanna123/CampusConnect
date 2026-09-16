"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FadeIn } from "@/components/FadeIn";

// University email verification — this single page covers both halves of
// the flow: submitting the .edu address (no ?token in the URL) and landing
// back here from the emailed link to confirm it (?token=...).
export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-card">
          <h1 className="heading-tight">Verify Your University Email</h1>
        </div>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (token) return <ConfirmToken token={token} />;
  return <RequestForm />;
}

function RequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/verification/university/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Check your inbox</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p className="profile-meta">
            We sent a verification link to <strong>{email}</strong>. Click it
            to get your verified badge.
          </p>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Verification</span>
        <h1 className="heading-tight">Verify your university email</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <p className="profile-meta">Required to post, request, or message on CampusConnect.</p>
        <form onSubmit={handleSubmit} className="app-form">
          <div>
            <label htmlFor="email">University email</label>
            <input
              id="email"
              type="email"
              placeholder="you@uci.edu"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Sending…" : "Send verification link"}
          </button>
        </form>
      </FadeIn>
    </div>
  );
}

function ConfirmToken({ token }: { token: string }) {
  const [state, setState] = useState<"confirming" | "success" | "error">(
    "confirming",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/verification/university/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (cancelled) return;
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setState("success");
        } else {
          setState("error");
          setMessage(body.error ?? "Verification failed.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
          setMessage("Something went wrong. Try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "confirming") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Verify your university email</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p className="profile-meta">Confirming your verification link…</p>
        </FadeIn>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">✓ University Verified</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p className="profile-meta">Your badge is live. You can now post, request, and message.</p>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <FadeIn mode="mount" delay={0}>
        <h1 className="heading-tight">Verification Failed</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <p className="profile-meta">{message}</p>
      </FadeIn>
    </div>
  );
}
