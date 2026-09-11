import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeletePostButton } from "@/components/DeletePostButton";
import { MarkPackagePostCompleteButton } from "@/components/MarkPackagePostCompleteButton";
import { PackageMessageForm } from "@/components/PackageMessageForm";
import { PosterBadge } from "@/components/ExploreCard";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";

// PackagePost detail -- mirrors the shape of /trips/[id] and /requests/[id]
// (public preview for a logged-out visitor, studentsOnly 404 gate, owner
// actions, Report/Block) but with none of the seat/connection machinery --
// the only interaction here is PackageMessageForm, since there's no formal
// accept handshake for a package post at all (per product decision).
export default async function PackagePostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  const { id } = await params;
  const found = await prisma.packagePost.findUnique({
    where: { id },
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      postedBy: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          signedUpAsParent: true,
          verifications: {
            where: { status: "verified" },
            select: { type: true, status: true },
          },
        },
      },
    },
  });
  if (!found) notFound();

  const isOwner = user ? found.postedById === user.id : false;
  if (found.studentsOnly && !isOwner && !(user && hasStudentRecord(user))) {
    notFound();
  }
  const initialBlocked =
    isOwner || !user ? false : await isBlockedBetween(user.id, found.postedById);
  const destinationLabel = found.destinationCity?.name ?? found.destinationText;

  return (
    <div>
      <div className="detail-header">
        {found.studentsOnly && <span className="badge-students-only">🎓 Students only</span>}
        <span className="eyebrow">
          {found.kind === "offering_space" ? "Package space offered" : "Delivery needed"}
        </span>
        <h1 className="heading-tight detail-route-headline">
          {found.originCity.name} → {destinationLabel}
        </h1>
        <p className="detail-route-subtitle">
          {found.originCity.name}
          {found.originCity.region ? `, ${found.originCity.region.name}` : ""} →{" "}
          {destinationLabel}
          {found.destinationCity?.region ? `, ${found.destinationCity.region.name}` : ""}
        </p>
        <p className={`trip-status-label trip-status-label-${found.status}`}>
          {found.status}
        </p>
      </div>
      <div className="detail-facts">
        {found.date && (
          <p>
            {found.date.toLocaleDateString()}
            {found.time && ` at ${found.time}`}
            {found.flexibleTime && " (flexible)"}
          </p>
        )}
        {found.notes && <p>{found.notes}</p>}
      </div>
      <div className="detail-poster-row">
        <Link href={`/profile/${found.postedBy.id}`} className="plain-link">
          <PosterBadge poster={found.postedBy} />
        </Link>
      </div>
      {!isOwner && user && (
        <div className="button-row">
          <ReportButton
            reportedUserId={found.postedBy.id}
            contextType="package"
            contextId={found.id}
          />
          <BlockButton
            blockedUserId={found.postedBy.id}
            initialBlocked={initialBlocked}
          />
        </div>
      )}
      {isOwner && found.status === "open" && (
        <div className="button-row">
          <Link href={`/package-posts/${found.id}/edit`} className="btn-secondary">
            Edit
          </Link>
          <MarkPackagePostCompleteButton packagePostId={found.id} />
          <DeletePostButton
            deleteUrl={`/api/package-posts/${found.id}`}
            redirectTo="/my-posts"
            actionLabel="Cancel post"
            confirmMessage="Cancel this post? This can't be undone."
          />
        </div>
      )}
      {!isOwner &&
        (user ? (
          found.status === "open" && <PackageMessageForm packagePostId={found.id} />
        ) : (
          <Link href="/sign-up" className="connection-request-button btn-primary">
            Message about this post
          </Link>
        ))}
    </div>
  );
}
