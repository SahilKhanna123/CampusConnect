import Link from "next/link";
import { ConnectionRequestButton, type ConnectionStatus } from "@/components/ConnectionRequestButton";

export type Poster = {
  id: string;
  name: string;
  photoUrl: string | null;
  signedUpAsParent: boolean;
  verifications: { type: string; status: string }[];
  // Real-data enrichment for the card's stats line (university/year,
  // completed-trip count) -- all optional/undefined wherever a caller
  // (e.g. /connections' own PosterBadge reuse) hasn't computed them, in
  // which case that piece is simply omitted from the line rather than
  // showing a placeholder. Populated by /explore's own batched queries --
  // see resolvePosterStats in src/app/explore/page.tsx.
  year?: string | null;
  universityName?: string | null;
  completedTripCount?: number;
};

// User.year is deliberately free text (see the schema comment), not a
// class-year enum -- "Senior", "Junior", "2027" are all valid. A 4-digit
// year gets the reference design's "'26" short form; anything else (a
// class-standing word, or a year outside a sane range) is shown as-is
// rather than mangled by a substring operation that assumes a specific
// format.
function formatYearLabel(year: string): string {
  return /^(19|20)\d{2}$/.test(year) ? `'${year.slice(2)}` : year;
}

// SupportedUniversityDomain.universityName stores the full formal name
// ("University of California, Irvine") -- too long to sit on a compact
// card meta line alongside the role/rating/trip-count segments. Shortened
// to the standard "UC <campus>" form only for that one common pattern;
// any other university name (there's only ever been one in this app's
// real data, but a future domain could add more) is shown exactly as
// stored rather than guessed at.
function shortenUniversityName(name: string): string {
  const ucMatch = name.match(/^University of California,?\s+(.+)$/i);
  return ucMatch ? `UC ${ucMatch[1]}` : name;
}

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
  // The role label always renders (it's the one thing every caller of this
  // component has, unlike the optional stats below), then university/year,
  // rating, and completed-trip count each add their own "·"-separated
  // segment only when present -- so a caller with none of that data still
  // renders a clean single "Student" or "Parent" line, same as before this
  // stats line existed.
  const schoolYear =
    poster.universityName &&
    `${shortenUniversityName(poster.universityName)}${poster.year ? ` ${formatYearLabel(poster.year)}` : ""}`;

  return (
    <div className="explore-card-poster">
      {poster.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster.photoUrl}
          alt=""
          width={34}
          height={34}
          className="explore-card-avatar avatar-circle"
        />
      ) : (
        <span
          className="explore-card-avatar avatar-circle explore-card-avatar-placeholder"
          aria-hidden="true"
        >
          {poster.name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="explore-card-poster-info">
        <div className="explore-card-poster-name-row">
          <span className="explore-card-poster-name">{poster.name}</span>
          {posterIsVerified(poster) && (
            <span className="badge-verified">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M13.5 4.5 6 12 2.5 8.5l1-1L6 10l6.5-6.5z" />
              </svg>
              Verified
            </span>
          )}
        </div>
        <div className="explore-card-poster-role">
          <span>{posterRoleLabel(poster)}</span>
          {schoolYear && (
            <>
              <span className="explore-card-poster-role-sep" aria-hidden="true">
                ·
              </span>
              <span>{schoolYear}</span>
            </>
          )}
          {!!poster.completedTripCount && (
            <>
              <span className="explore-card-poster-role-sep" aria-hidden="true">
                ·
              </span>
              <span>
                {poster.completedTripCount} trip{poster.completedTripCount === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Formats a card's date the way the reference "campus routes" mockup does
// ("Today", "Fri, Sep 5") rather than a locale-default numeric date -- a
// pure display tweak, no new data involved.
function formatCardDate(date: Date | null): string {
  if (!date) return "Date flexible";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// The top-right seats badge -- always the same neutral gray, matching the
// reference exactly: a post with only one seat left doesn't turn the badge
// amber, it appends " · Last seat" onto the date/time line instead (see
// .explore-card-last-seat below).
function seatsBadgeText(post: ExploreCardPost): string {
  if (post.seatsRemaining <= 0) return "Full";
  return `${post.seatsRemaining} seat${post.seatsRemaining === 1 ? "" : "s"} left`;
}

// The reference design's small chevron-arrow icon between the two city
// names in the bold headline, in place of a plain "→" character -- kept
// as its own component since it's used nowhere else in this card (the
// smaller gray subtitle line below still uses a plain arrow character,
// matching the reference exactly).
function RouteArrow() {
  return (
    <svg
      width="16"
      height="8"
      viewBox="0 0 16 8"
      fill="none"
      className="explore-card-route-arrow"
      aria-hidden="true"
    >
      <path
        d="M1 4h13M11 1.5l2.5 2.5L11 6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type TripCardPost = {
  kind: "offer";
  id: string;
  title: string | null;
  originName: string;
  destinationName: string;
  // Region names for the smaller route-subtitle line under the bold city
  // headline (e.g. "Cupertino, Bay Area -> Irvine, UC Irvine"). Optional so
  // a caller that hasn't widened its Prisma `include` to join Region yet
  // still type-checks -- the subtitle line is simply omitted when absent.
  originRegionName?: string | null;
  destinationRegionName?: string | null;
  // Real-world coordinates for the Explore route map (see RouteMap.tsx),
  // resolved server-side via src/lib/geocode.ts. Optional/undefined
  // wherever a caller hasn't computed them, or null when geocoding a
  // write-in destinationText found no match -- either way, RouteMap simply
  // omits a post it can't plot rather than guessing a position.
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  date: Date;
  time: string | null;
  flexibleTime: boolean;
  seatsTotal: number;
  seatsRemaining: number;
  poster: Poster;
  // The viewer's own latest ConnectionRequest status for this Trip ("none"
  // if they've never requested, or a fresh request is allowed again after
  // a decline/cancel -- see the ConnectionRequest schema comment).
  connectionRequestStatus: ConnectionStatus;
  // How many people have a confirmed seat on this trip (ConnectionRequest
  // + SeatOffer, see getConfirmedRiderCounts in src/lib/tripParticipants.ts)
  // -- surfaced compactly here so confirmed riders are visible even before
  // clicking through to /trips/[id]'s own public Riders roster, per product
  // decision. Optional/undefined wherever a caller hasn't computed it.
  confirmedRiderCount?: number;
  // See the schema comment on Trip.studentsOnly -- this card only ever
  // renders for a viewer who's actually allowed to see it (the query that
  // builds this post already excludes it otherwise), so this is purely a
  // "🎓 Students only" label, not an access check.
  studentsOnly: boolean;
  // Trip.tripNotes, shown as an italicized quote at the bottom of the card
  // (per the reference mockup, e.g. "Happy to stop near South Station for
  // pickup.") -- optional/undefined wherever a caller hasn't selected it,
  // null/omitted the same "don't fabricate" way an unset field is handled
  // elsewhere in this card.
  note?: string | null;
};

export type ExploreCardPost = TripCardPost;

// Renders a Trip offer -- used by the Explore page's grid. Clicking the
// card body opens /trips/[id]. The card is a <div> wrapping an inner <Link>
// (not a <Link> itself) so the card's ConnectionRequestButton can sit as a
// sibling, not nested inside the anchor -- HTML disallows interactive
// content (a <button>) inside an <a>, and nesting them would also make
// clicks ambiguous.
export function ExploreCard({
  post,
  isLoggedIn = true,
}: {
  post: ExploreCardPost;
  // Defaults to true so Home (/, src/app/page.tsx), which also renders this
  // card but stays fully auth-gated (always has a real viewer), needs no
  // change here. /explore is the one caller that ever passes false, for its
  // logged-out public-preview visitors.
  isLoggedIn?: boolean;
}) {
  const href = `/trips/${post.id}`;
  const isLastSeat = post.seatsRemaining === 1;

  return (
    <div className="explore-card">
      <Link href={href} className="explore-card-link">
        <div className="explore-card-top">
          <div className="explore-card-route-headline">
            <span>{post.originName}</span>
            <RouteArrow />
            <span>{post.destinationName}</span>
          </div>
          <span className="explore-card-seats-badge">{seatsBadgeText(post)}</span>
        </div>

        {post.studentsOnly && (
          <div className="explore-card-students-only">🎓 Students only</div>
        )}

        {post.title && <div className="explore-card-title">{post.title}</div>}

        {(post.originRegionName || post.destinationRegionName) && (
          <div className="explore-card-route-subtitle">
            {post.originName}
            {post.originRegionName ? `, ${post.originRegionName}` : ""} →{" "}
            {post.destinationName}
            {post.destinationRegionName ? `, ${post.destinationRegionName}` : ""}
          </div>
        )}

        <div className="explore-card-meta">
          {formatCardDate(post.date)}
          {post.time && ` · ${post.time}`}
          {post.flexibleTime && " (flexible)"}
          {isLastSeat && <span className="explore-card-last-seat"> · Last seat</span>}
        </div>

        {!!post.confirmedRiderCount && (
          <div className="explore-card-riders">
            🎫 {post.confirmedRiderCount} confirmed rider
            {post.confirmedRiderCount === 1 ? "" : "s"}
          </div>
        )}
      </Link>

      <div className="explore-card-divider" />

      <div className="explore-card-footer">
        <PosterBadge poster={post.poster} />
        <div className="explore-card-actions">
          {isLoggedIn ? (
            <ConnectionRequestButton
              tripId={post.id}
              initialStatus={post.connectionRequestStatus}
            />
          ) : (
            // Same label as the real button, but a plain link to sign-up --
            // clicking it takes a logged-out visitor straight there rather
            // than opening the note composer, per product decision.
            <Link href="/sign-up" className="connection-request-button btn-primary">
              Request to Connect
            </Link>
          )}
        </div>
      </div>

      {post.note && <p className="explore-card-note">&ldquo;{post.note}&rdquo;</p>}
    </div>
  );
}
