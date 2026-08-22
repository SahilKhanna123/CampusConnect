import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { ReportButton } from "@/components/ReportButton";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const found = await prisma.request.findUnique({
    where: { id },
    include: {
      originCity: { include: { region: true } },
      destinationCity: { include: { region: true } },
      postedBy: { select: { id: true, name: true, photoUrl: true } },
    },
  });
  if (!found) notFound();

  const isOwner = found.postedById === user.id;
  const destinationLabel =
    found.destinationCity?.name ?? found.destinationText ?? "?";

  return (
    <div>
      <h1>
        {found.type === "ride" ? "Ride needed: " : "Delivery needed: "}
        {found.originCity?.name ?? "?"} → {destinationLabel}
      </h1>
      <p>Status: {requestDisplayStatus(found)}</p>
      {found.neededDate && (
        <p>
          {found.neededDate.toLocaleDateString()}
          {found.neededTime && ` at ${found.neededTime}`}
          {found.flexibleTime && " (flexible)"}
        </p>
      )}
      {found.type === "ride" && found.seatsRequested && (
        <p>Seats needed: {found.seatsRequested}</p>
      )}
      {found.type === "package" && (
        <p>
          {found.packageDescription}
          {found.packageSize && ` — ${found.packageSize}`}
        </p>
      )}
      {found.notes && <p>{found.notes}</p>}
      <p>
        Posted by{" "}
        <Link href={`/profile/${found.postedBy.id}`}>
          {found.postedBy.name}
        </Link>
      </p>
      {!isOwner && (
        <ReportButton
          reportedUserId={found.postedBy.id}
          contextType="request"
          contextId={found.id}
        />
      )}

      {isOwner && (
        <div>
          <Link href={`/requests/${found.id}/edit`}>Edit</Link>
          {" · "}
          <DeletePostButton
            deleteUrl={`/api/requests/${found.id}`}
            redirectTo="/my-posts"
          />
        </div>
      )}
    </div>
  );
}
