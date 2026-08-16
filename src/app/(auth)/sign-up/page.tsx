// Sign up — students must enter + verify their university email as a
// required step of onboarding (not deferrable to later). Parents never land
// here directly; the only path to a parent account is a ParentStudentInvite link.
// TODO: Supabase Auth signup, then redirect into the university-email step.

export default function SignUpPage() {
  return (
    <div>
      <h1>Sign Up</h1>
      <p>Account creation + university email verification flow.</p>
    </div>
  );
}
