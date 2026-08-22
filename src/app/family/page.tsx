import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InviteParentForm } from "@/components/InviteParentForm";
import { ApproveParentLinkButton } from "@/components/ApproveParentLinkButton";

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
// text, matching the parenthetical convention /profile's own read-only
// Linked Students list already uses for otp_verified.
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

// Family — the interactive management hub for both directions of
// parent/student linking (see the Family Linking section of CLAUDE.md):
// a parent managing their linked students (and adding more, via
// /family/connect-student), and a student inviting/approving parents. This
// is deliberately the one place with real ACTIONS (invite, approve); the
// read-only "Linked Students" list on /profile predates this page and is
// left alone, not merged in here.
export default async function FamilyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [sentInvites, linkedParents] = await Promise.all([
    prisma.parentStudentInvite.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    user.studentRecord
      ? prisma.parentStudentLink.findMany({
          where: { studentRecordId: user.studentRecord.id },
          include: { parent: { select: { id: true, name: true, photoUrl: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ]);

  return (
    <div>
      <h1>Family</h1>
      <p>Manage the parents and students connected to your account.</p>

      <section>
        <h2>Your Linked Students</h2>
        {user.parentLinksAsParent.length === 0 ? (
          <p>You haven&apos;t connected any students yet.</p>
        ) : (
          <ul className="connection-list">
            {user.parentLinksAsParent.map((link) => (
              <li key={link.id} className="connection-item">
                {link.studentRecord.fullName} —{" "}
                {link.studentRecord.universityDomain.universityName}
                <div className="connection-item-meta">
                  <span className={statusLabelClass(link.status)}>
                    {statusLabelText(link.status)}
                  </span>
                  {link.status === "otp_verified" &&
                    " (connection not yet confirmed by student)"}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link href="/family/connect-student">+ Connect another student</Link>
        </p>
      </section>

      {user.studentRecord && (
        <>
          <section>
            <h2>Invite a Parent/Guardian</h2>
            <p>
              Invite a parent or guardian to connect with you. They&apos;ll be
              able to see rides and package requests related to you and post
              on your behalf, clearly labeled as posted by them, for you.
            </p>
            <InviteParentForm />
          </section>

          <section>
            <h2>Your Linked Parents</h2>
            {linkedParents.length === 0 ? (
              <p>No parents or guardians connected yet.</p>
            ) : (
              <ul className="connection-list">
                {linkedParents.map((link) => (
                  <li key={link.id} className="connection-item">
                    {link.parent.name}
                    <div className="connection-item-meta">
                      <span className={statusLabelClass(link.status)}>
                        {statusLabelText(link.status)}
                      </span>
                      {link.status === "otp_verified" &&
                        " (they proved access to your email — confirm this is really your parent/guardian)"}
                    </div>
                    {link.status === "otp_verified" && (
                      <ApproveParentLinkButton linkId={link.id} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Sent Invites</h2>
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
                      {invite.parentEmail}
                      <div className="connection-item-meta">
                        Sent {invite.createdAt.toLocaleDateString()} ·{" "}
                        <span className={statusLabelClass(displayStatus)}>
                          {statusLabelText(displayStatus)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
