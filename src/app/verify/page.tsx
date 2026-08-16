// University email verification landing page — confirms the signed,
// single-use, expiring token from the verification email and marks the
// matching VerificationRecord(type=university) as verified.
// TODO: read ?token= from searchParams, POST to /api/verification/university/confirm.

export default function VerifyPage() {
  return (
    <div>
      <h1>Verify Your University Email</h1>
      <p>Confirming your verification link…</p>
    </div>
  );
}
