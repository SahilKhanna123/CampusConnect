"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FadeIn } from "@/components/FadeIn";

type Persona = "student" | "parent" | "alumni" | "traveler";

const PERSONAS: { key: Persona; label: string }[] = [
  { key: "student", label: "I'm a Student" },
  { key: "parent", label: "I'm a Parent" },
  { key: "alumni", label: "I'm Alumni" },
  { key: "traveler", label: "I'm a Traveler" },
];

// Sign up — creates the Supabase Auth account. The persona picker below is
// NOT a stored/permanent role (USER != ROLE, per the plan doc) -- it only
// decides where you land and how the account gets created:
//
// Student/Alumni/Traveler go through the normal supabase.auth.signUp() +
// confirm (link or code) flow and land on Home. For a Student, signup email
// doubles as the university-verification input: the onboarding bridge
// (src/lib/onboarding.ts) checks the confirmed email's domain and
// auto-grants the university badge (and claims/creates their StudentRecord)
// in the same trip if it matches a supported school -- no separate step.
//
// Parent skips email confirmation entirely -- their own email isn't the
// security-critical verification in this product (the student's university
// email is, via a separate OTP in the next step). POSTs to
// /api/auth/parent-signup, which creates a pre-confirmed Supabase user via
// the admin API, then signs in immediately client-side and lands on
// /family/connect-student to link a student. This is a narrow bypass
// scoped to that one route -- it does NOT touch Supabase's project-wide
// confirm-email setting, so the Student path above is completely unaffected
// and stays fully rigorous.
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

  // Student/alumni/traveler land on /onboarding to fill in name/photo/home
  // area (a soft nudge, not a hard gate -- see src/app/layout.tsx). Parent
  // lands on /family/connect-student, which folds the equivalent profile
  // step in as step 0 ahead of the (mandatory) student-linking steps.
  const postConfirmPath =
    persona === "parent" ? "/family/connect-student" : "/onboarding";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    if (persona === "parent") {
      const signupRes = await fetch("/api/auth/parent-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!signupRes.ok) {
        const body = await signupRes.json().catch(() => ({}));
        setError(body.error ?? "Something went wrong. Try again.");
        setStatus("idle");
        return;
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setStatus("idle");
        return;
      }

      const syncRes = await fetch("/api/auth/sync", { method: "POST" });
      if (!syncRes.ok) {
        setError(
          "Account created, but couldn't finish setting up. Try refreshing.",
        );
        setStatus("idle");
        return;
      }

      router.push(postConfirmPath);
      router.refresh();
      return;
    }

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
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <span className="eyebrow">Get started</span>
          <h1 className="heading-tight">How will you use CampusConnect?</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <div className="persona-picker">
            {PERSONAS.map((p) => (
              <button key={p.key} onClick={() => setPersona(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </FadeIn>
        <FadeIn mode="mount" delay={180}>
          <p className="auth-footer">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </FadeIn>
      </div>
    );
  }

  if (status === "sent" || status === "verifying") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <span className="eyebrow">Almost there</span>
          <h1 className="heading-tight">Check your email</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p className="profile-meta">
            We sent a confirmation link to <strong>{email}</strong> — click it,
            or enter the code from the same email below (use the code if the
            link doesn&apos;t work, which can happen with some university
            email systems).
          </p>
          <form onSubmit={handleVerifyCode} className="app-form">
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
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <FadeIn mode="mount" delay={0}>
        <button className="auth-back-button" onClick={() => setPersona(null)}>
          &larr; {PERSONAS.find((p) => p.key === persona)?.label}
        </button>
        <span className="eyebrow">Sign up</span>
        <h1 className="heading-tight">Create your account</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <form onSubmit={handleSubmit} className="app-form">
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
              <p className="profile-meta">
                Using your university email (e.g. @uci.edu)? We&apos;ll
                auto-verify it — no separate step needed.
              </p>
            )}
            {persona === "parent" && (
              <p className="profile-meta">
                This is your own email — no confirmation needed. You&apos;ll
                verify your student&apos;s university email in the next step.
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
      </FadeIn>
    </div>
  );
}
