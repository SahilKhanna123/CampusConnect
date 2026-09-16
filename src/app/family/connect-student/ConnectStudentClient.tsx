"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileEditForm } from "@/components/ProfileEditForm";
import { FadeIn } from "@/components/FadeIn";
import type { SelectedCity } from "@/components/CityAutocomplete";

// Parent-facing wizard. Step 0 ("profile") collects name/photo/home-area --
// the parent-onboarding fields -- via the same ProfileEditForm used for
// student onboarding and self-profile editing. Steps "email"/"code" are
// unchanged from before: prove access to the student's university inbox via
// a code CampusConnect emails to the STUDENT, not the parent. See
// src/app/api/family/parent-link/{request,confirm}/route.ts for what
// happens server-side, and the security note on ParentStudentLink in
// prisma/schema.prisma for why OTP possession alone is treated as
// sufficient to establish otp_verified (not full trust) status.
//
// This is also the mandatory gate a parent-signup account can't get past
// (see src/app/layout.tsx / hasLinkedStudent in src/lib/auth.ts) -- a
// parent must link at least one student before using any other part of the
// app. The copy below is written for that first-time case; a parent who
// already has a linked student and lands here again (e.g. to add a second
// student) sees the same flow, just starting at "email" since skipProfileStep
// is true by then.
export function ConnectStudentClient({
  initialName,
  initialPhotoUrl,
  initialHomeCityId,
  initialHomeCity,
  initialPhone,
  initialLinkedStudentName,
  skipProfileStep,
}: {
  initialName: string;
  initialPhotoUrl: string | null;
  initialHomeCityId: string | null;
  initialHomeCity: SelectedCity;
  initialPhone: string | null;
  initialLinkedStudentName: string | null;
  skipProfileStep: boolean;
}) {
  const router = useRouter();
  const [studentEmail, setStudentEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"profile" | "email" | "code" | "done">(
    skipProfileStep ? "email" : "profile",
  );
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/family/parent-link/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentEmail }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setStatus("idle");
    setStep("code");
  }

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("submitting");

    const res = await fetch("/api/family/parent-link/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentEmail, code: code.trim() }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Try again.");
      setStatus("idle");
      return;
    }

    setStep("done");
  }

  if (step === "profile") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <span className="eyebrow">Step 1 of 3</span>
          <h1 className="heading-tight">Your profile</h1>
          <p className="profile-meta">
            First, tell us a bit about yourself. You&apos;ll connect your
            student next.
          </p>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <ProfileEditForm
            initialName={initialName}
            initialPhotoUrl={initialPhotoUrl}
            initialHomeCityId={initialHomeCityId}
            initialHomeCity={initialHomeCity}
            isParent={true}
            initialMajor={null}
            initialYear={null}
            initialTravelPreferences={null}
            initialLookingFor={[]}
            initialPhone={initialPhone}
            initialLinkedStudentName={initialLinkedStudentName}
            submitLabel="Continue"
            onSaved={() => setStep("email")}
          />
        </FadeIn>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <span className="eyebrow">All set</span>
          <h1 className="heading-tight">You&apos;re connected</h1>
          <p className="profile-meta">
            You can now use CampusConnect, including posting rides and package
            requests on behalf of your student. We&apos;ve also emailed{" "}
            {studentEmail} to let them know, with an easy way for them to
            remove the connection if this wasn&apos;t expected.
          </p>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <button className="btn-primary" onClick={() => router.push("/")}>
            Go to Home
          </button>
        </FadeIn>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <span className="eyebrow">Step 3 of 3</span>
          <h1 className="heading-tight">Enter the code</h1>
          <p className="profile-meta">
            We sent a verification code to <strong>{studentEmail}</strong>. Ask
            your student for the code, or check the inbox yourself if you have
            access, and enter it below.
          </p>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <form onSubmit={handleSubmitCode} className="app-form">
            <div>
              <label htmlFor="code">Verification code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && <p role="alert">{error}</p>}
            <button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "Verifying…" : "Verify code"}
            </button>
          </form>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Step 2 of 3</span>
        <h1 className="heading-tight">Connect your student</h1>
        <p className="profile-meta">
          To use CampusConnect, connect at least one student. Enter your
          student&apos;s university email below — we&apos;ll send a
          verification code there, not to you, to confirm this is really
          their school email before connecting your accounts.
        </p>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <form onSubmit={handleSubmitEmail} className="app-form">
          <div>
            <label htmlFor="studentEmail">Student&apos;s university email</label>
            <input
              id="studentEmail"
              type="email"
              placeholder="student@uci.edu"
              required
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
            />
          </div>
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={status === "submitting"}>
            {status === "submitting" ? "Sending…" : "Send verification code"}
          </button>
        </form>
      </FadeIn>
    </div>
  );
}
