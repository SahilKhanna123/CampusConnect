"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Parent-facing: connect to a student by proving access to their
// university inbox via a code CampusConnect emails to the STUDENT, not the
// parent. Two steps on one page: enter the student's email, then enter the
// code. See src/app/api/family/parent-link/{request,confirm}/route.ts for
// what happens server-side, and the security note on ParentStudentLink in
// prisma/schema.prisma for why OTP possession alone is treated as
// sufficient to establish otp_verified (not full trust) status.
export default function ConnectStudentPage() {
  const router = useRouter();
  const [studentEmail, setStudentEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code" | "done">("email");
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

  if (step === "done") {
    return (
      <div>
        <h1>You&apos;re Connected</h1>
        <p>
          You can now post rides and package requests on behalf of your
          student. We&apos;ve also emailed {studentEmail} to let them know,
          with an easy way for them to remove the connection if this wasn&apos;t
          expected.
        </p>
        <button onClick={() => router.push("/")}>Go to Home</button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div>
        <h1>Enter the Code</h1>
        <p>
          We sent a verification code to <strong>{studentEmail}</strong>. Ask
          your student for the code, or check the inbox yourself if you have
          access, and enter it below.
        </p>
        <form onSubmit={handleSubmitCode}>
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
      </div>
    );
  }

  return (
    <div>
      <h1>Connect Your Student</h1>
      <p>
        Enter your student&apos;s university email. We&apos;ll send a
        verification code there — not to you — to confirm this is really
        their school email before connecting your accounts.
      </p>
      <form onSubmit={handleSubmitEmail}>
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
    </div>
  );
}
