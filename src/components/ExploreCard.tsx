import Link from "next/link";
import { ConnectionRequestButton, type ConnectionStatus } from "@/components/ConnectionRequestButton";

export type Poster = {
  id: string;
  name: string;
  photoUrl: string | null;
  signedUpAsParent: boolean;
  verifications: { type: string; status: string }[];
};

// A lightweight status label for the card -- not the same helpers as
// universityBadgeLabel/parentRelationshipBadgeLabel in src/lib/auth.ts,
// which require the full CurrentUser include shape (parentLinksAsParent,
// homeCity, studentRecord, ...). This only needs signedUpAsParent and the
// poster's verified VerificationRecord types, both of which the Explore
// query selects directly for every card's poster.
function posterRoleLabel(poster: Poster): string {
  return poster.signedUpAsParent ? "Parent" : "Student";
}

function posterIsVerified(poster: Poster): boolean {
  return poster.verifications.some(
    (v) =>
      (v.type === "university" || v.type === "parent_relationship") &&
      v.status === "verified",
  );
}

// Exported -- also used by /connections to show "Requester's name, Profile
// picture, Student/parent status" with the exact same visual treatment as
// Explore cards, rather than re-implementing that block a third time.
export function PosterBadge({ poster }: { poster: Poster }) {
  return (
    <div className="explore-card-poster">
      {poster.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster.photoUrl}
          alt=""
          width={36}
          height={36}
          className="explore-card-avatar"
        />
      ) : (
        <div
          className="explore-card-avatar explore-card-avatar-placeholder"
          aria-hidden="true"
        />
      )}
      <div>
        <div className="explore-card-poster-name">{poster.name}</div>
        <div className="explore-card-poster-role">
          {posterRoleLabel(poster)}
          {posterIsVerified(poster) && " · ✓ Verified"}
        </div>
      </div>
    </div>
  );
}

export type TripCardPost = {
  kind: "offer";
  id: string;
  title: string | null;
  originName: string;
  destinationName: string;
  date: Date;
  time: string | null;
  flexibleTime: boolean;
  seatsTotal: number;
  seatsRemaining: number;
  poster: Poster;
  // The viewer's own latest ConnectionRequest status for this Trip ("none"
  // if they've never requested, or a fresh request is allowed again after
  // a decline/cancel -- see the ConnectionRequest schema comment). Only
  // ever set for offer posts -- a Request has no "trip owner" to connect
  // with in this feature's scope.
  connectionRequestStatus: ConnectionStatus;
  // How many people have a confirmed seat on this trip (ConnectionRequest
  // + SeatOffer, see getConfirmedRiderCounts in src/lib/tripParticipants.ts)
  // -- surfaced compactly here so confirmed riders are visible even before
  // clicking through to /trips/[id]'s own public Riders roster, per product
  // decision. Optional/undefined wherever a caller hasn't computed it.
  confirmedRiderCount?: number;
};

export type RequestCardPost = {
  kind: "request";
  id: string;
  originName: string;
  destinationName: string;
  date: Date | null;
  time: string | null;
  flexibleTime: boolean;
  seatsRequested: number;
  poster: Poster;
};

export type ExploreCardPost = TripCardPost | RequestCardPost;

// One card renders either a Trip (offer) or a standalone Request (need) --
// used by the Explore page's grid. Clicking the card body opens the same
// detail page My Posts already links to (/trips/[id], /requests/[id]). The
// card is a <div> wrapping an inner <Link> (not a <Link> itself) so an
// offer card's ConnectionRequestButton can sit as a sibling, not nested
// inside the anchor -- HTML disallows interactive content (a <button>)
// inside an <a>, and nesting them would also make clicks ambiguous.
export function ExploreCard({ post }: { post: ExploreCardPost }) {
  const href = post.kind === "offer" ? `/trips/${post.id}` : `/requests/${post.id}`;

  return (
    <div className="explore-card">
      <Link href={href} className="explore-card-link">
        <div className="explore-card-top">
          <PosterBadge poster={post.poster} />
          <span
            className={
              post.kind === "offer"
                ? "explore-card-kind explore-card-kind-offer"
                : "explore-card-kind explore-card-kind-request"
            }
          >
            {post.kind === "offer" ? "Offering a ride" : "Needs a ride"}
          </span>
        </div>

        {post.kind === "offer" && (
          <div className="explore-card-title">{post.title || "Untitled trip"}</div>
        )}

        <div className="explore-card-route">
          {post.originName} → {post.destinationName}
        </div>

        <div className="explore-card-meta">
          {post.date ? post.date.toLocaleDateString() : "Date flexible"}
          {post.time && ` at ${post.time}`}
          {post.flexibleTime && " (flexible)"}
        </div>

        <div className="explore-card-seats">
          {post.kind === "offer"
            ? `Seats available: ${post.seatsRemaining} / ${post.seatsTotal}`
            : `Seats needed: ${post.seatsRequested}`}
        </div>

        {post.kind === "offer" && !!post.confirmedRiderCount && (
          <div className="explore-card-riders">
            🎫 {post.confirmedRiderCount} confirmed rider
            {post.confirmedRiderCount === 1 ? "" : "s"}
          </div>
        )}
      </Link>

      {post.kind === "offer" && (
        <div className="explore-card-actions">
          <ConnectionRequestButton
            tripId={post.id}
            initialStatus={post.connectionRequestStatus}
          />
        </div>
      )}
    </div>
  );
}
