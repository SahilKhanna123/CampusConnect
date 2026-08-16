import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendUniversityVerificationEmail(params: {
  to: string;
  verifyUrl: string;
  universityName: string;
}) {
  const { to, verifyUrl, universityName } = params;

  if (!resend) {
    // Local dev without RESEND_API_KEY configured — don't block the flow,
    // just surface the link so it can be clicked manually.
    console.log(
      `[email:dev] University verification link for ${to} (${universityName}): ${verifyUrl}`,
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "CampusConnect <onboarding@resend.dev>",
    to,
    subject: `Verify your ${universityName} email for CampusConnect`,
    html: `<p>Confirm this is your ${universityName} email to get your verified badge on CampusConnect.</p><p><a href="${verifyUrl}">Verify my university email</a></p><p>This link expires in 48 hours.</p>`,
  });

  // The Resend SDK returns { error } instead of throwing — without this
  // check, a failed send (e.g. the sandbox sender's recipient restriction)
  // looks identical to success and the caller has no way to know.
  if (error) {
    console.error(
      `[email] Failed to send university verification to ${to}:`,
      error,
    );
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
}
