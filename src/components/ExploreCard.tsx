import Link from "next/link";

type Poster = {
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

function PosterBadge({ poster }: { poster: Poster }) {
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
// used by the Explore page's grid. Clicking anywhere on the card opens the
// same detail page as My Posts already links to (/trips/[id],
// /requests/[id]).
export function ExploreCard({ post }: { post: ExploreCardPost }) {
  const href = post.kind === "offer" ? `/trips/${post.id}` : `/requests/${post.id}`;

  return (
    <Link href={href} className="explore-card">
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
    </Link>
  );
}
