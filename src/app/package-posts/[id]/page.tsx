import { notFound, redirect } from "next/navigation";
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
import { FadeIn } from "@/components/FadeIn";

// PackagePost detail -- mirrors the shape of /trips/[id] (gated for a
// logged-out visitor, studentsOnly 404 gate, owner actions, Report/Block)
// but with none of the seat/connection machinery -- the only interaction
// here is PackageMessageForm, since there's no formal accept handshake for
// a package post at all (per product decision).
export default async function PackagePostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-up");

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

  const isOwner = found.postedById === user.id;
  if (found.studentsOnly && !isOwner && !hasStudentRecord(user)) {
    notFound();
  }
  const initialBlocked = isOwner ? false : await isBlockedBetween(user.id, found.postedById);
  const destinationLabel = found.destinationCity?.name ?? found.destinationText;

  return (
    <div>
      <FadeIn mode="mount" delay={0} className="detail-header">
        {found.studentsOnly && <span className="badge-students-only">🎓 Students only</span>}
        <span className="eyebrow">Package space offered</span>
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
      </FadeIn>
      <FadeIn mode="mount" delay={90} className="detail-facts">
        {found.date && (
          <p>
            {found.date.toLocaleDateString()}
            {found.time && ` at ${found.time}`}
            {found.flexibleTime && " (flexible)"}
          </p>
        )}
        {found.notes && <p>{found.notes}</p>}
      </FadeIn>
      <FadeIn mode="mount" delay={180} className="detail-poster-row">
        <Link href={`/profile/${found.postedBy.id}`} className="plain-link">
          <PosterBadge poster={found.postedBy} />
        </Link>
      </FadeIn>
      {!isOwner && (
        <FadeIn mode="viewport" className="button-row">
          <ReportButton
            reportedUserId={found.postedBy.id}
            contextType="package"
            contextId={found.id}
          />
          <BlockButton
            blockedUserId={found.postedBy.id}
            initialBlocked={initialBlocked}
          />
        </FadeIn>
      )}
      {isOwner && found.status === "open" && (
        <FadeIn mode="viewport" className="button-row">
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
        </FadeIn>
      )}
      {!isOwner && found.status === "open" && (
        <FadeIn mode="viewport">
          <PackageMessageForm packagePostId={found.id} />
        </FadeIn>
      )}
    </div>
  );
}
