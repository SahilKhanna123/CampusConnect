"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Sign up — creates the Supabase Auth account. Signup email doubles as the
// university-verification input: src/app/auth/callback/route.ts checks the
// confirmed email's domain and auto-grants the university badge in the same
// trip if it matches a supported school, so students who sign up with their
// .edu address need no separate step. Anyone who signs up with a personal
// email can still add a university badge later via /verify.
// Parents never land here directly — the only path to a parent account is
// accepting a ParentStudentInvite (src/app/api/family/invite/accept).
export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">(
    "idle",
  );
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

  if (status === "sent") {
    return (
      <div>
        <h1>Check your email</h1>
        <p>
          We sent a confirmation link to <strong>{email}</strong>. Click it
          to activate your account.
        </p>
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
