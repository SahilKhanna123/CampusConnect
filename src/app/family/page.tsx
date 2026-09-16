import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, isUniversityVerified } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApproveLinkButton } from "@/components/ApproveLinkButton";
import { InviteParentForm } from "@/components/InviteParentForm";
import { FadeIn } from "@/components/FadeIn";

// Maps a ParentStudentLink/ParentStudentInvite status onto the existing
// connection-status-label-* palette (pending=amber, accepted=green,
// declined/cancelled=grey) from src/app/globals.css -- reused as-is rather
// than inventing new colors/classes for what's the same "where does this
// stand" visual language already established for ConnectionRequest.
function statusLabelClass(status: string): string {
  if (status === "otp_verified" || status === "pending") {
    return "connection-status-label connection-status-label-pending";
  }
  if (status === "approved" || status === "accepted") {
    return "connection-status-label connection-status-label-accepted";
  }
  return "connection-status-label connection-status-label-cancelled";
}

// Short words only -- the shared .connection-status-label CSS class
// capitalizes every word (fine for "pending"/"accepted", wrong for a full
// sentence), so any longer explanation is rendered separately as plain
// text.
function statusLabelText(status: string): string {
  switch (status) {
    case "otp_verified":
      return "unconfirmed";
    case "approved":
      return "connected";
    case "revoked":
      return "removed";
    default:
      return status;
  }
}

// The student's own view of both linking directions for their
// StudentRecord -- approving a parent-initiated OTP link (see POST
// /api/family/link/[id]/approve) and inviting a parent/guardian directly
// (see POST /api/family/invite, the reverse, student-initiated direction).
// A parent's own linked students already show on their /profile page
// ("Linked Students" section), so a parent visiting here is pointed there
// instead of duplicating that list.
export default async function FamilyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.signedUpAsParent) {
    return (
      <div>
        <FadeIn mode="mount" delay={0}>
          <span className="eyebrow">Family</span>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <h1 className="heading-tight">Family</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={180}>
          <p>
            Your linked students are shown on <Link href="/profile">your profile</Link>.
          </p>
        </FadeIn>
      </div>
    );
  }

  if (!user.studentRecord) {
    return (
      <div>
        <FadeIn mode="mount" delay={0}>
          <span className="eyebrow">Family</span>
        </FadeIn>
        <FadeIn mode="mount" delay={90}>
          <h1 className="heading-tight">Family</h1>
        </FadeIn>
        <FadeIn mode="mount" delay={180}>
          <p>This page is for managing parent connections to a student account.</p>
        </FadeIn>
      </div>
    );
  }

  const [links, sentInvites] = await Promise.all([
    prisma.parentStudentLink.findMany({
      where: { studentRecordId: user.studentRecord.id },
      include: { parent: { select: { id: true, name: true, photoUrl: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.parentStudentInvite.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Family</span>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <h1 className="heading-tight">Family</h1>
      </FadeIn>
      <FadeIn mode="mount" delay={180}>
        <p className="profile-meta">Manage the parents and guardians connected to your account.</p>
      </FadeIn>

      <FadeIn mode="viewport">
        <section className="profile-section">
          <h2 className="profile-section-title">Parents Connected to You</h2>
          {links.length === 0 ? (
            <p>No parent connections yet.</p>
          ) : (
            <ul className="connection-list">
              {links.map((link) => (
                <li key={link.id} className="connection-item">
                  <FadeIn mode="viewport">
                    {link.parent.name}
                    <div className="connection-item-meta">
                      <span className={statusLabelClass(link.status)}>
                        {statusLabelText(link.status)}
                      </span>
                      {link.status === "otp_verified" &&
                        " (they proved access to your email — confirm this is really your parent/guardian)"}
                    </div>
                    {link.status === "otp_verified" && (
                      <ApproveLinkButton linkId={link.id} />
                    )}
                  </FadeIn>
                </li>
              ))}
            </ul>
          )}
        </section>
      </FadeIn>

      {isUniversityVerified(user) ? (
        <>
          <FadeIn mode="viewport">
            <section className="profile-section">
              <h2 className="profile-section-title">Invite a Parent/Guardian</h2>
              <p className="profile-section-hint">
                Invite a parent or guardian to connect with you. They&apos;ll be
                able to see rides and package requests related to you and post
                on your behalf, clearly labeled as posted by them, for you.
              </p>
              <InviteParentForm />
            </section>
          </FadeIn>

          <FadeIn mode="viewport">
            <section className="profile-section">
              <h2 className="profile-section-title">Sent Invites</h2>
              {sentInvites.length === 0 ? (
                <p>No invites sent yet.</p>
              ) : (
                <ul className="connection-list">
                  {sentInvites.map((invite) => {
                    const isExpired =
                      invite.status === "pending" && invite.expiresAt < new Date();
                    const displayStatus = isExpired ? "expired" : invite.status;
                    return (
                      <li key={invite.id} className="connection-item">
                        <FadeIn mode="viewport">
                          {invite.parentEmail}
                          <div className="connection-item-meta">
                            Sent {invite.createdAt.toLocaleDateString()} ·{" "}
                            <span className={statusLabelClass(displayStatus)}>
                              {statusLabelText(displayStatus)}
                            </span>
                          </div>
                        </FadeIn>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </FadeIn>
        </>
      ) : (
        <FadeIn mode="viewport">
          <div className="profile-section">
            <p>Verify your university email to invite a parent or guardian.</p>
            <Link href="/verify" className="btn-secondary">
              Verify your university email
            </Link>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
