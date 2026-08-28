import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, hasStudentRecord } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requestDisplayStatus, tripDisplayStatus } from "@/lib/postStatus";
import { DeletePostButton } from "@/components/DeletePostButton";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";
import { FulfillRequestForm } from "@/components/FulfillRequestForm";
import { MarkRequestCompleteButton } from "@/components/MarkRequestCompleteButton";
import { ReviewForm } from "@/components/ReviewForm";

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
      trip: {
        include: {
          originCity: true,
          destinationCity: true,
          traveler: { select: { id: true, name: true, photoUrl: true } },
        },
      },
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, photoUrl: true } },
        },
      },
    },
  });
  if (!found) notFound();

  const isOwner = found.postedById === user.id;
  // studentsOnly requests are invisible to a non-student, non-owner viewer
  // -- same 404-not-403 idiom as the equivalent gate on /trips/[id].
  if (found.studentsOnly && !isOwner && !hasStudentRecord(user)) notFound();
  const isTripOwner = found.trip?.traveler.id === user.id;
  const counterpartId = isOwner ? found.trip?.traveler.id : found.postedBy.id;
  const counterpartName = isOwner ? found.trip?.traveler.name : found.postedBy.name;
  const myReview = found.reviews.find((r) => r.reviewerId === user.id);
  const theirReview = counterpartId
    ? found.reviews.find((r) => r.reviewerId === counterpartId)
    : undefined;
  const initialBlocked = isOwner
    ? false
    : await isBlockedBetween(user.id, found.postedById);
  const destinationLabel =
    found.destinationCity?.name ?? found.destinationText ?? "?";

  // Non-owner + still pending + not yet matched to any trip: offer the
  // viewer a picker over their own eligible upcoming Trips (package
  // requests are further filtered to trips with packageSpaceAvailable, a
  // hard capacity precondition -- not a "matching/search" heuristic, which
  // stays out of scope everywhere else in this app). tripDisplayStatus is
  // reapplied in JS since DB status:"upcoming" alone doesn't exclude a
  // trip whose date has already passed, same gate every other
  // actionability check in this app already uses.
  const canOffer = !isOwner && requestDisplayStatus(found) === "pending" && found.tripId === null;
  const eligibleTrips = canOffer
    ? (
        await prisma.trip.findMany({
          where: {
            travelerId: user.id,
            status: "upcoming",
            ...(found.type === "package" ? { packageSpaceAvailable: true } : {}),
          },
          include: { originCity: true, destinationCity: true },
        })
      ).filter((t) => tripDisplayStatus(t) === "upcoming")
    : [];

  return (
    <div>
      <h1>
        {found.type === "ride" ? "Ride needed: " : "Delivery needed: "}
        {found.originCity?.name ?? "?"} → {destinationLabel}
      </h1>
      <p>Status: {requestDisplayStatus(found)}</p>
      {found.studentsOnly && <p>🎓 Visible to students only</p>}
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
        <>
          <ReportButton
            reportedUserId={found.postedBy.id}
            contextType="request"
            contextId={found.id}
          />{" "}
          <BlockButton
            blockedUserId={found.postedBy.id}
            initialBlocked={initialBlocked}
          />
        </>
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

      {canOffer && (
        <div>
          {eligibleTrips.length > 0 ? (
            <FulfillRequestForm
              requestId={found.id}
              trips={eligibleTrips.map((t) => ({
                id: t.id,
                title: t.title,
                originCityName: t.originCity.name,
                destinationName: t.destinationCity?.name ?? t.destinationText ?? "?",
                departureDate: t.departureDate.toISOString(),
              }))}
            />
          ) : (
            <p>
              You don&apos;t have any upcoming trips that could fulfill this
              request. <Link href="/post/trip">Post a trip</Link> to offer one.
            </p>
          )}
        </div>
      )}

      {found.trip && (found.status === "accepted" || found.status === "completed") && (
        <div>
          <p>
            Being fulfilled by{" "}
            <Link href={`/profile/${found.trip.traveler.id}`}>
              {found.trip.traveler.name}
            </Link>
            &apos;s{" "}
            <Link href={`/trips/${found.trip.id}`}>
              trip to {found.trip.destinationCity?.name ?? found.trip.destinationText ?? "?"}
            </Link>
            .
          </p>
          {found.status === "accepted" && (isOwner || isTripOwner) && (
            <MarkRequestCompleteButton requestId={found.id} />
          )}
        </div>
      )}

      {found.status === "completed" && found.trip && (isOwner || isTripOwner) && (
        <div className="review-section">
          {theirReview && (
            <p>
              {counterpartName} rated you {theirReview.rating}/5
              {theirReview.comment && `: "${theirReview.comment}"`}
            </p>
          )}
          {myReview ? (
            <p>
              You rated {counterpartName} {myReview.rating}/5.
            </p>
          ) : (
            <ReviewForm requestId={found.id} revieweeName={counterpartName ?? "them"} />
          )}
        </div>
      )}
    </div>
  );
}
