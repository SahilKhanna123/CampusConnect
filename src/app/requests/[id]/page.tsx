import { notFound } from "next/navigation";
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
import { PosterBadge } from "@/components/ExploreCard";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Deliberately not gated: an unauthenticated visitor gets a read-only
  // preview of a request's detail page, same product decision and pattern
  // as /trips/[id] (see that file's own comment on this).
  const user = await getCurrentUser();

  const { id } = await params;
  const found = await prisma.request.findUnique({
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
      trip: {
        include: {
          originCity: true,
          destinationCity: true,
          traveler: {
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
      },
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true, photoUrl: true } },
        },
      },
    },
  });
  if (!found) notFound();

  const isOwner = user ? found.postedById === user.id : false;
  // studentsOnly requests are invisible to a non-student, non-owner viewer
  // -- same 404-not-403 idiom as the equivalent gate on /trips/[id]. An
  // anonymous visitor is treated the same as any other non-student.
  if (found.studentsOnly && !isOwner && !(user && hasStudentRecord(user))) {
    notFound();
  }
  const isTripOwner = user ? found.trip?.traveler.id === user.id : false;
  const counterpartId = isOwner ? found.trip?.traveler.id : found.postedBy.id;
  const counterpartName = isOwner ? found.trip?.traveler.name : found.postedBy.name;
  const myReview = user
    ? found.reviews.find((r) => r.reviewerId === user.id)
    : undefined;
  const theirReview = counterpartId
    ? found.reviews.find((r) => r.reviewerId === counterpartId)
    : undefined;
  const initialBlocked =
    isOwner || !user ? false : await isBlockedBetween(user.id, found.postedById);
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
  const eligibleTrips = canOffer && user
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
      <div className="detail-header">
        {found.studentsOnly && <span className="badge-students-only">🎓 Students only</span>}
        <span className="eyebrow">
          {found.type === "ride" ? "Ride needed" : "Delivery needed"}
        </span>
        <h1 className="heading-tight detail-route-headline">
          {found.originCity?.name ?? "?"} → {destinationLabel}
        </h1>
        <p className="detail-route-subtitle">
          {found.originCity?.name ?? "?"}
          {found.originCity?.region ? `, ${found.originCity.region.name}` : ""} →{" "}
          {destinationLabel}
          {found.destinationCity?.region ? `, ${found.destinationCity.region.name}` : ""}
        </p>
        <p className="trip-status-label">{requestDisplayStatus(found)}</p>
      </div>
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
      <div className="detail-poster-row">
        <Link href={`/profile/${found.postedBy.id}`}>
          <PosterBadge poster={found.postedBy} />
        </Link>
      </div>
      {/* Reporting/blocking inherently requires an account -- see the
          equivalent comment on /trips/[id] for why these are simply absent
          for an anonymous viewer rather than linking to sign-up. */}
      {!isOwner && user && (
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
          <Link href={`/requests/${found.id}/edit`} className="btn-secondary">
            Edit
          </Link>{" "}
          <DeletePostButton
            deleteUrl={`/api/requests/${found.id}`}
            redirectTo="/my-posts"
          />
        </div>
      )}

      {canOffer && (
        <div>
          {!user ? (
            <Link href="/sign-up" className="connection-request-button btn-primary">
              Offer one of your trips
            </Link>
          ) : eligibleTrips.length > 0 ? (
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
        <div className="trip-participant-row">
          <div>
            <Link href={`/profile/${found.trip.traveler.id}`}>
              <PosterBadge poster={found.trip.traveler} />
            </Link>
            <p>
              Fulfilling with{" "}
              <Link href={`/trips/${found.trip.id}`}>
                trip to {found.trip.destinationCity?.name ?? found.trip.destinationText ?? "?"}
              </Link>
              .
            </p>
          </div>
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
