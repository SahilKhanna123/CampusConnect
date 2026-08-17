"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Persona = "student" | "parent" | "alumni" | "traveler";

const PERSONAS: { key: Persona; label: string }[] = [
  { key: "student", label: "I'm a Student" },
  { key: "parent", label: "I'm a Parent" },
  { key: "alumni", label: "I'm Alumni" },
  { key: "traveler", label: "I'm a Traveler" },
];

// Sign up — creates the Supabase Auth account. The persona picker below is
// NOT a stored/permanent role (USER != ROLE, per the plan doc) -- it only
// decides where you land after confirming: Student/Alumni/Traveler go
// straight to Home; Parent goes to /family/connect-student next, to link a
// student by proving access to their university inbox (see that page and
// src/app/api/family/parent-link/*). Parents fully self-signup through this
// same form now -- there's no separate parent-only signup path or
// invite-required gate.
//
// For a Student, signup email doubles as the university-verification
// input: the onboarding bridge (src/lib/onboarding.ts) checks the confirmed
// email's domain and auto-grants the university badge (and claims/creates
// their StudentRecord) in the same trip if it matches a supported school --
// no separate step. Anyone who signs up with a personal email can still add
// a university badge later via /verify.
//
// Confirmation offers BOTH a link and a numeric code (Supabase's default is
// 8 digits, not 6 -- don't hardcode a length in the UI): some university mail
// gateways pre-fetch links to scan them, which silently consumes the
// single-use link token before the real user clicks it (confirmed via a
// real test — Supabase's own confirmed-7-seconds-after-sent timestamps
// don't lie). The code is typed by hand, so it's immune to that.
export default function SignUpPage() {
  const router = useRouter();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "submitting" | "sent" | "verifying"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const postConfirmPath =
    persona === "parent" ? "/family/connect-student" : "/";

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
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(postConfirmPath)}`,
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

    router.push(postConfirmPath);
    router.refresh();
  }

  if (!persona) {
    return (
      <div>
        <h1>How will you use CampusConnect?</h1>
        <ul>
          {PERSONAS.map((p) => (
            <li key={p.key}>
              <button onClick={() => setPersona(p.key)}>{p.label}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (status === "sent" || status === "verifying") {
    return (
      <div>
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{email}</strong> — click it,
          or enter the code from the same email below (use the code if the
          link doesn&apos;t work, which can happen with some university
          email systems).
        </p>
        <form onSubmit={handleVerifyCode}>
          <div>
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
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
      <p>
        <button onClick={() => setPersona(null)}>
          &larr; {PERSONAS.find((p) => p.key === persona)?.label}
        </button>
      </p>
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
          {persona === "student" && (
            <p>
              Using your university email (e.g. @uci.edu)? We&apos;ll
              auto-verify it — no separate step needed.
            </p>
          )}
          {persona === "parent" && (
            <p>
              This is your own email — you&apos;ll connect your student&apos;s
              university email in the next step.
            </p>
          )}
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
