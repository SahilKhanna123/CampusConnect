"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Sign up — creates the Supabase Auth account. Signup email doubles as the
// university-verification input: the onboarding bridge (src/lib/onboarding.ts)
// checks the confirmed email's domain and auto-grants the university badge
// in the same trip if it matches a supported school, so students who sign up
// with their .edu address need no separate step. Anyone who signs up with a
// personal email can still add a university badge later via /verify.
// Parents never land here directly — the only path to a parent account is
// accepting a ParentStudentInvite (src/app/api/family/invite/accept).
//
// Confirmation offers BOTH a link and a 6-digit code: some university mail
// gateways pre-fetch links to scan them, which silently consumes the
// single-use link token before the real user clicks it (confirmed via a
// real test — Supabase's own confirmed-7-seconds-after-sent timestamps
// don't lie). The code is typed by hand, so it's immune to that.
export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "verifying"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setStatus("idle");
      return;
    }

    setStatus("sent");
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("verifying");

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });

    if (verifyError) {
      setError(verifyError.message);
      setStatus("sent");
      return;
    }

    const syncRes = await fetch("/api/auth/sync", { method: "POST" });
    if (!syncRes.ok) {
      setError(
        "Verified, but couldn't finish setting up your account. Try refreshing.",
      );
      setStatus("sent");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (status === "sent" || status === "verifying") {
    return (
      <div>
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{email}</strong> — click it,
          or enter the 6-digit code from the same email below (use the code
          if the link doesn&apos;t work, which can happen with some
          university email systems).
        </p>
        <form onSubmit={handleVerifyCode}>
          <div>
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={status === "verifying"}>
            {status === "verifying" ? "Verifying…" : "Verify code"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1>Sign Up</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p>
            Using your university email (e.g. @uci.edu)? We&apos;ll
            auto-verify it — no separate step needed.
          </p>
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={status === "submitting"}>
          {status === "submitting" ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </div>
  );
}
