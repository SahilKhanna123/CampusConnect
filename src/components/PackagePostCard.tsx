import Link from "next/link";
import { PosterBadge, type Poster } from "@/components/ExploreCard";

// A PackagePost-shaped sibling to ExploreCard -- reuses the exact same
// shell classes (.explore-card, .explore-card-top, etc.) so a package
// card's *size* on Home matches a Trip/Request card exactly. The 50/30/10
// visual-prominence weighting between package/Uber-share/personal-car
// content is carried entirely by section-level order/count/heading on the
// page that renders these cards, not by giving this card its own size.
//
// Unlike ExploreCard, there's no owner-action branching here (no
// isLoggedIn prop): a PackagePost's only interaction -- PackageMessageForm
// -- lives on its own detail page, not the card, so the footer is always
// the same plain "View details" link for every viewer.

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

function formatCardDate(date: Date | null): string {
  if (!date) return "Date flexible";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export type PackagePostCardPost = {
  id: string;
  kind: "offering_space" | "needing_delivery";
  originName: string;
  destinationName: string;
  originRegionName?: string | null;
  destinationRegionName?: string | null;
  date: Date | null;
  time: string | null;
  flexibleTime: boolean;
  notes?: string | null;
  studentsOnly: boolean;
  poster: Poster;
};

export function PackagePostCard({ post }: { post: PackagePostCardPost }) {
  const href = `/package-posts/${post.id}`;
  const kindLabel = post.kind === "offering_space" ? "📦 Offering space" : "📦 Need delivery";

  return (
    <div className="explore-card">
      <Link href={href} className="explore-card-link">
        <div className="explore-card-top">
          <div className="explore-card-route-headline">
            <span>{post.originName}</span>
            <RouteArrow />
            <span>{post.destinationName}</span>
          </div>
          <span className="explore-card-seats-badge">{kindLabel}</span>
        </div>

        {post.studentsOnly && (
          <div className="explore-card-students-only">🎓 Students only</div>
        )}

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
        </div>
      </Link>

      <div className="explore-card-divider" />

      <div className="explore-card-footer">
        <PosterBadge poster={post.poster} />
        <div className="explore-card-actions">
          <Link href={href} className="btn-secondary">
            View details
          </Link>
        </div>
      </div>

      {post.notes && <p className="explore-card-note">&ldquo;{post.notes}&rdquo;</p>}
    </div>
  );
}
