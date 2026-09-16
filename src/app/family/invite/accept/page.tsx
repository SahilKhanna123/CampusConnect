import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AcceptFamilyInviteButton } from "@/components/AcceptFamilyInviteButton";
import { FadeIn } from "@/components/FadeIn";

// Landing page for the link in sendParentInviteEmail (the student-initiated
// direction, see POST /api/family/invite). Unlike LinkObjectionPage, this
// route REQUIRES an account -- accepting only happens once the caller is
// signed in with the exact invited email (see POST
// /api/family/invite/accept) -- so this is a Server Component that can call
// getCurrentUser() directly, rather than the public/no-auth client-only
// shape link-objection uses. Exempt from the parent-link gate (see
// src/app/layout.tsx) so a brand-new parent-signup account can reach this
// page at all before having linked anyone yet.
export default async function AcceptFamilyInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Accept Family Invitation</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p>This link is missing information and can&apos;t be used.</p>
        </FadeIn>
      </div>
    );
  }

  const invite = await prisma.parentStudentInvite.findUnique({
    where: { token },
    include: { student: { select: { name: true } } },
  });

  if (!invite) {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Accept Family Invitation</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p>This invite link isn&apos;t valid.</p>
        </FadeIn>
      </div>
    );
  }

  if (invite.status === "accepted") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Already Accepted</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p>This invitation has already been accepted.</p>
        </FadeIn>
      </div>
    );
  }

  if (invite.status === "revoked") {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Invitation No Longer Available</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p>This invitation is no longer available.</p>
        </FadeIn>
      </div>
    );
  }

  // Derived, never persisted from here -- same "compute at read time"
  // convention as tripDisplayStatus in postStatus.ts.
  // POST /api/family/invite/accept is what actually flips status to
  // "expired" in the DB, the first time someone tries to accept past
  // expiresAt -- this page just needs to show the right thing meanwhile.
  const isExpired = invite.status === "expired" || invite.expiresAt < new Date();
  if (isExpired) {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Invitation Expired</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p>Ask {invite.student.name} to send a new invite.</p>
        </FadeIn>
      </div>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Accept Family Invitation</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p>
            <strong>{invite.student.name}</strong> invited you to connect as
            their parent/guardian on CampusConnect.
          </p>
          <p>
            Log in or sign up using <strong>{invite.parentEmail}</strong> — the
            exact email this invite was sent to — then come back to this link
            to accept.
          </p>
          <div className="button-row">
            <Link href="/login" className="btn-secondary">
              Log in
            </Link>
            <Link href="/sign-up" className="btn-primary">
              Sign up
            </Link>
          </div>
        </FadeIn>
      </div>
    );
  }

  if (user.email.toLowerCase() !== invite.parentEmail) {
    return (
      <div className="auth-card">
        <FadeIn mode="mount" delay={0}>
          <h1 className="heading-tight">Wrong Account</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <p>
            This invite was sent to <strong>{invite.parentEmail}</strong>, but
            you&apos;re signed in as {user.email}. Sign out and log in or sign
            up with that exact email to accept it.
          </p>
        </FadeIn>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <FadeIn mode="mount" delay={0}>
        <h1 className="heading-tight">Accept Family Invitation</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <p>
          <strong>{invite.student.name}</strong> invited you to connect as
          their parent/guardian on CampusConnect. Accepting lets you see rides
          and package requests related to them and post on their behalf,
          clearly labeled as posted by you, for them.
        </p>
        <AcceptFamilyInviteButton token={token} />
      </FadeIn>
    </div>
  );
}
