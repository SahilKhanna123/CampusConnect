import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApproveLinkButton } from "@/components/ApproveLinkButton";

const STATUS_LABEL: Record<string, string> = {
  otp_verified: "Connection not yet confirmed by you",
  approved: "Approved",
  revoked: "Revoked",
};

// The student's own view of parents linked to their StudentRecord --
// approving here is what upgrades an otp_verified link to full mutual
// trust (see POST /api/family/link/[id]/approve). A parent's own linked
// students already show on their /profile page ("Linked Students"
// section), so a parent visiting here is pointed there instead of
// duplicating that list.
export default async function FamilyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.signedUpAsParent) {
    return (
      <div>
        <h1>Family</h1>
        <p>
          Your linked students are shown on <Link href="/profile">your profile</Link>.
        </p>
      </div>
    );
  }

  if (!user.studentRecord) {
    return (
      <div>
        <h1>Family</h1>
        <p>This page is for managing parent connections to a student account.</p>
      </div>
    );
  }

  const links = await prisma.parentStudentLink.findMany({
    where: { studentRecordId: user.studentRecord.id },
    include: { parent: { select: { id: true, name: true, photoUrl: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Family</h1>
      <p>Parents connected to your student account.</p>

      {links.length === 0 ? (
        <p>No parent connections yet.</p>
      ) : (
        <ul>
          {links.map((link) => (
            <li key={link.id}>
              {link.parent.name} — {STATUS_LABEL[link.status] ?? link.status}
              {link.status === "otp_verified" && (
                <>
                  {" "}
                  <ApproveLinkButton linkId={link.id} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
