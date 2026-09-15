import Link from "next/link";

// Post — 3 distinct sections (Trips, Uber-sharing, Package carrying), each
// with its own form, per product decision to stop bundling ride and package
// concepts together on one Trip row. "Offer a Ride" and "Split an
// Uber/Lyft" both create a Trip, distinguished by Trip.category (see
// TripPostForm) -- they're the same underlying lifecycle (post → connect →
// confirm seat → message → complete), just different framing/fields.
// "Offer Package Space" creates a PackagePost -- a deliberately separate,
// minimal model with no seat/capacity lifecycle at all. `weight` is purely
// presentational -- per product decision, package carrying is the visually
// featured/primary option, Uber-sharing is secondary, and driving-your-own-
// car is the smallest/least emphasized -- see the post-hub-tile-${weight}
// classes in globals.css. The standalone "Need a Ride"/"Need to Split an
// Uber"/"Need Something Delivered" flow was removed entirely per direct
// product decision -- posting is offer-only now.
const POST_ACTIONS = [
  {
    key: "offer-package",
    label: "Offer Package Space",
    href: "/post/package",
    weight: "primary" as const,
  },
  {
    key: "offer-uber",
    label: "Split an Uber/Lyft",
    href: "/post/trip?category=uber_share",
    weight: "secondary" as const,
  },
  {
    key: "offer-ride",
    label: "Offer a Ride (my car)",
    href: "/post/trip?category=personal_car",
    weight: "tertiary" as const,
  },
];

export default function PostPage() {
  return (
    <div className="form-page">
      <span className="eyebrow">Post</span>
      <h1 className="heading-tight">What do you want to post?</h1>
      <div className="post-hub-tiles">
        {POST_ACTIONS.map((action) => (
          <Link
            key={action.key}
            href={action.href}
            className={`post-hub-tile post-hub-tile-${action.weight}`}
          >
            {action.label}
          </Link>
        ))}
      </div>
      <p className="post-hub-footer">
        <Link href="/my-posts" className="btn-secondary">
          View your posts
        </Link>
      </p>
    </div>
  );
}
