import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// User-controlled strings (e.g. User.name, only length-validated at the
// Zod layer -- see POST /api/profile) get interpolated into these HTML
// email bodies and sent to a DIFFERENT person than the one who set the
// name. Without escaping, a name like `<a href="evil">Accept</a>` would
// render as real HTML in the recipient's inbox -- a genuine cross-user
// stored-XSS/phishing vector, not self-XSS. Apply this at every
// HTML-body interpolation of a user-controlled value below; system-
// generated values (tokens, URLs, the OTP code, an admin-seeded
// university name) don't need it.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function send(params: {
  to: string;
  subject: string;
  html: string;
  devLogLabel: string;
}) {
  const { to, subject, html, devLogLabel } = params;

  if (!resend) {
    // Local dev without RESEND_API_KEY configured — don't block the flow,
    // just log so the content can still be inspected/acted on manually.
    // NEVER do this in production: the logged HTML can contain a plaintext
    // OTP code or a single-use verification/objection/invite token, and a
    // misconfigured deploy with RESEND_API_KEY accidentally unset would
    // otherwise leak those into whatever log storage that deploy retains.
    // Fail loudly instead so a missing key in production is caught, not
    // silently routed to the console.
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `RESEND_API_KEY is not configured -- refusing to log "${devLogLabel}" (which may contain a sensitive code/token) to the console in production.`,
      );
    }
    console.log(`[email:dev] ${devLogLabel} for ${to}:\n${html}`);
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "CampusConnect <onboarding@resend.dev>",
    to,
    subject,
    html,
  });

  // The Resend SDK returns { error } instead of throwing — without this
  // check, a failed send (e.g. the sandbox sender's recipient restriction)
  // looks identical to success and the caller has no way to know.
  if (error) {
    console.error(`[email] Failed to send "${devLogLabel}" to ${to}:`, error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendUniversityVerificationEmail(params: {
  to: string;
  verifyUrl: string;
  universityName: string;
}) {
  const { to, verifyUrl, universityName } = params;
  await send({
    to,
    subject: `Verify your ${universityName} email for CampusConnect`,
    html: `<p>Confirm this is your ${universityName} email to get your verified badge on CampusConnect.</p><p><a href="${verifyUrl}">Verify my university email</a></p><p>This link expires in 48 hours.</p>`,
    devLogLabel: "University verification link",
  });
}

// Sent to the STUDENT's inbox on a parent's behalf — the student never
// initiated this, so the copy has to make that unambiguous and explain
// what entering the code actually does.
export async function sendParentConnectionOtpEmail(params: {
  to: string;
  parentName: string;
  otpCode: string;
}) {
  const { to, parentName, otpCode } = params;
  await send({
    to,
    subject: "Parent Connection Request — CampusConnect",
    html: `
      <p><strong>${escapeHtml(parentName)}</strong> is requesting to connect with you on CampusConnect as your parent/guardian.</p>
      <p>If you approve this connection, give them this verification code to enter in CampusConnect:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otpCode}</p>
      <p>This code expires in 20 minutes. If you don't recognize this request, you can safely ignore this email — no connection will be made without the code above.</p>
    `,
    devLogLabel: "Parent connection OTP",
  });
}

// Sent immediately once a parent's OTP confirms — distinct from the OTP
// email above, and the primary safety mechanism for the interim window
// before the student has confirmed anything: a one-click, no-account-
// required way to shut the connection down. The link lands on a
// confirmation PAGE requiring an explicit click, never an auto-acting GET —
// email security scanners are known to pre-fetch links (confirmed
// firsthand in this project), and an auto-revoking GET would let a scanner
// falsely reject a legitimate connection.
// Sent to the PARENT's own inbox -- the reverse direction from
// sendParentConnectionOtpEmail above: here the student already has a
// CampusConnect account and is the one initiating, so this goes straight
// to the parent's own email rather than needing to prove access to
// anything. Accepting requires signing in/up with this exact address (see
// POST /api/family/invite/accept), so the copy doesn't need to warn about
// unrecognized requests the way the parent-initiated OTP email does.
export async function sendParentInviteEmail(params: {
  to: string;
  studentName: string;
  acceptUrl: string;
}) {
  const { to, studentName, acceptUrl } = params;
  await send({
    to,
    subject: `${studentName} invited you to connect on CampusConnect`,
    html: `
      <p><strong>${escapeHtml(studentName)}</strong> invited you to connect as their parent/guardian on CampusConnect.</p>
      <p>Accepting lets you see rides and package requests related to them and post on their behalf, clearly labeled as posted by you, for them.</p>
      <p><a href="${acceptUrl}">Accept the invitation</a></p>
      <p>You'll need to log in or sign up using this email address (${to}) to accept. This invitation expires in 7 days.</p>
    `,
    devLogLabel: "Parent invite",
  });
}

export async function sendParentConnectionNoticeEmail(params: {
  to: string;
  parentName: string;
  objectionUrl: string;
}) {
  const { to, parentName, objectionUrl } = params;
  await send({
    to,
    subject: "A parent has connected with you on CampusConnect",
    html: `
      <p><strong>${escapeHtml(parentName)}</strong> has connected with you as a parent/guardian on CampusConnect using this email address.</p>
      <p>They can now post rides and package requests on your behalf, clearly labeled as posted by them, for you. They do not have access to your CampusConnect account, messages, or any account you create.</p>
      <p>If you don't recognize this or don't want this connection, you can remove it without needing to create an account:</p>
      <p><a href="${objectionUrl}">This wasn't me — remove this connection</a></p>
    `,
    devLogLabel: "Parent connection notice",
  });
}
