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
export function formatYearLabel(year: string): string {
  return /^(19|20)\d{2}$/.test(year) ? `'${year.slice(2)}` : year;
}

// SupportedUniversityDomain.universityName stores the full formal name
// ("University of California, Irvine") -- too long to sit on a compact
// card meta line alongside the role/rating/trip-count segments. Shortened
// to the standard "UC <campus>" form only for that one common pattern;
// any other university name (there's only ever been one in this app's
// real data, but a future domain could add more) is shown exactly as
// stored rather than guessed at.
export function shortenUniversityName(name: string): string {
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

// Deterministic per-user avatar color for the initials placeholder (no
// photoUrl) -- same person always gets the same color everywhere they
// appear, without needing to store a color on User. Palette deliberately
// excludes green, which the rest of the app reserves for verified/trust
// signals (badge-verified, the "confirmed rider" line) -- see the
// HomeHeroIllustration comment in src/app/page.tsx for the same rule
// applied to decorative art.
const AVATAR_PALETTE: { bg: string; text: string }[] = [
  { bg: "#EFF6FF", text: "#1D6FFF" },
  { bg: "#FFF1E6", text: "#C2570C" },
  { bg: "#F3EEFE", text: "#7C3AED" },
  { bg: "#FDEEF1", text: "#E11D48" },
  { bg: "#FEF3C7", text: "#B45309" },
  { bg: "#EEF0FE", text: "#4F46E5" },
];

function avatarColorFor(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function posterIsVerified(poster: Poster): boolean {
  return poster.verifications.some(
    (v) =>
      (v.type === "university" || v.type === "parent_relationship") &&
      v.status === "verified",
  );
}

// Exported -- lets a caller that needs just the circular photo/initials
// (e.g. the trip detail page's larger sidebar avatar) reuse the exact same
// photo-or-colored-initials logic as PosterBadge below, at a different
// size, without duplicating it. Still uses the shared `avatar-circle`
// plain-CSS class (not converted to Tailwind) -- it's relied on by every
// other avatar in the app (profile pages, trip detail), so forking it here
// would only create a second copy that can drift.
export function PosterAvatar({
  poster,
  size = 34,
  className = "",
}: {
  poster: Pick<Poster, "id" | "name" | "photoUrl">;
  size?: number;
  className?: string;
}) {
  return poster.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={poster.photoUrl}
      alt=""
      width={size}
      height={size}
      className={`avatar-circle flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={`avatar-circle flex-shrink-0 text-[0.6875rem] ${className}`}
      style={{
        width: size,
        height: size,
        background: avatarColorFor(poster.id).bg,
        color: avatarColorFor(poster.id).text,
        borderColor: "transparent",
      }}
      aria-hidden="true"
    >
      {poster.name.slice(0, 1).toUpperCase()}
    </span>
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
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <PosterAvatar poster={poster} />
      <div className="min-w-0">
        <div className="flex items-center gap-[7px] mb-[2px]">
          <span className="font-semibold text-[0.8125rem] text-black truncate">
            {poster.name}
          </span>
          {posterIsVerified(poster) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-bg py-0.5 px-2 text-[0.6875rem] font-bold text-green align-middle">
              <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M13.5 4.5 6 12 2.5 8.5l1-1L6 10l6.5-6.5z" />
              </svg>
              Verified
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-[6px] gap-y-[2px] text-[0.71875rem] text-gray-body">
          <span>{posterRoleLabel(poster)}</span>
          {schoolYear && (
            <>
              <span className="flex-shrink-0 text-[#d4d4d4]" aria-hidden="true">
                ·
              </span>
              <span>{schoolYear}</span>
            </>
          )}
          {!!poster.completedTripCount && (
            <>
              <span className="flex-shrink-0 text-[#d4d4d4]" aria-hidden="true">
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
// the amber last-seat span below).
function seatsBadgeText(post: ExploreCardPost): string {
  if (post.kind === "package") return "📦 Package space";
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
      className="flex-shrink-0 text-[#bebebe]"
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

// A PackagePost, normalized the same way TripCardPost is -- lets
// ExploreCard/ExploreMapView/RouteMap treat both post kinds as one
// interchangeable list (see the Explore page's view toggle, which can mix
// packages and rides in one grid/map). Coordinates are optional/undefined
// the same "omit rather than guess" way TripCardPost already handles them.
// No packageKind field -- every PackagePost is implicitly an offer of
// space, since the standalone "need something delivered" side was removed
// (see Trip Categories & Package Carrying in CLAUDE.md).
export type PackageCardPost = {
  kind: "package";
  id: string;
  originName: string;
  destinationName: string;
  originRegionName?: string | null;
  destinationRegionName?: string | null;
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  date: Date | null;
  time: string | null;
  flexibleTime: boolean;
  poster: Poster;
  studentsOnly: boolean;
  // PackagePost.notes -- same treatment as TripCardPost.note.
  note?: string | null;
};

export type ExploreCardPost = TripCardPost | PackageCardPost;

// One card renders either a Trip offer or a PackagePost -- used by the
// Explore page's grid. Clicking the card body opens the matching detail
// page (/trips/[id], /package-posts/[id]). The card is a <div> wrapping an
// inner <Link> (not a <Link> itself) so an offer card's
// ConnectionRequestButton can sit as a sibling, not nested inside the
// anchor -- HTML disallows interactive content (a <button>) inside an <a>,
// and nesting them would also make clicks ambiguous.
//
// Styled with Tailwind (see tailwind.config.ts's theme.extend, mapped onto
// this app's existing CSS custom properties) rather than the plain-CSS
// .explore-card* rules that used to live in globals.css -- those rules
// still exist there for two other still-unconverted callers of
// .badge-verified (Home, trip detail). The card's root keeps no class name
// of its own; the one exception is the footer div, which keeps the literal
// "explore-card-footer" class alongside its Tailwind layout classes purely
// so globals.css's `.explore-card-footer .connection-request-button,
// .explore-card-footer .btn-secondary` compact-sizing rule -- which targets
// the shared, unconverted ConnectionRequestButton/btn-secondary primitives
// -- keeps matching.
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
  const href = post.kind === "offer" ? `/trips/${post.id}` : `/package-posts/${post.id}`;
  const isLastSeat = post.kind === "offer" && post.seatsRemaining === 1;

  return (
    <div className="border-solid border-[1.5px] border-border rounded-card bg-white px-5 py-[18px] shadow-card transition-[border-color,box-shadow,transform] duration-[180ms] ease-in-out hover:-translate-y-0.5 hover:border-blue hover:shadow-hover">
      <Link href={href} className="block text-inherit no-underline">
        <div className="mb-[10px] flex items-start justify-between gap-2">
          <div className="mb-[3px] flex min-w-0 items-center gap-2 text-base font-extrabold tracking-tight text-black">
            <span className="truncate">{post.originName}</span>
            <RouteArrow />
            <span className="truncate">{post.destinationName}</span>
          </div>
          <span className="ml-3 flex-shrink-0 whitespace-nowrap text-right text-[0.6875rem] font-medium text-gray-meta">
            {seatsBadgeText(post)}
          </span>
        </div>

        {post.studentsOnly && (
          <div className="mb-1 inline-block rounded-full bg-blue-bg px-2 py-0.5 text-xs font-semibold text-blue">
            🎓 Students only
          </div>
        )}

        {post.kind === "offer" && post.title && (
          <div className="mb-1 line-clamp-1 break-words font-semibold">{post.title}</div>
        )}

        {(post.originRegionName || post.destinationRegionName) && (
          <div className="mt-0.5 truncate text-[0.71875rem] text-gray-meta">
            {post.originName}
            {post.originRegionName ? `, ${post.originRegionName}` : ""} →{" "}
            {post.destinationName}
            {post.destinationRegionName ? `, ${post.destinationRegionName}` : ""}
          </div>
        )}

        <div className="mb-3 text-[0.78125rem] text-gray-body">
          {formatCardDate(post.date)}
          {post.time && ` · ${post.time}`}
          {post.flexibleTime && " (flexible)"}
          {isLastSeat && <span className="font-semibold text-amber-500"> · Last seat</span>}
        </div>

        {post.kind === "offer" && !!post.confirmedRiderCount && (
          <div className="-mt-2 mb-3 text-[0.78125rem] text-[#1a7a3a]">
            🎫 {post.confirmedRiderCount} confirmed rider
            {post.confirmedRiderCount === 1 ? "" : "s"}
          </div>
        )}
      </Link>

      <div className="mb-3 h-px bg-gray-section" />

      <div className="explore-card-footer flex items-center justify-between gap-2">
        <PosterBadge poster={post.poster} />
        <div className="flex-shrink-0">
          {post.kind === "offer" ? (
            isLoggedIn ? (
              <ConnectionRequestButton
                tripId={post.id}
                initialStatus={post.connectionRequestStatus}
              />
            ) : (
              // Same label as the real button, but a plain link to sign-up
              // -- clicking it takes a logged-out visitor straight there
              // rather than opening the note composer, per product
              // decision.
              <Link href="/sign-up" className="connection-request-button btn-primary">
                Request to Connect
              </Link>
            )
          ) : (
            // A PackagePost's only interaction (PackageMessageForm) lives on
            // its own detail page, not the card -- same plain-link footer
            // for every viewer regardless of isLoggedIn, matching
            // PackagePostCard.tsx's identical convention on Home.
            <Link href={href} className="btn-secondary">
              View details
            </Link>
          )}
        </div>
      </div>

      {post.note && (
        <p className="mt-[10px] line-clamp-2 break-words border-solid border-t border-gray-section pt-[10px] text-xs italic leading-normal text-gray-meta">
          &ldquo;{post.note}&rdquo;
        </p>
      )}
    </div>
  );
}
