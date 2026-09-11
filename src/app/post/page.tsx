import Link from "next/link";

// Post — 3 distinct sections (Trips, Uber-sharing, Package carrying), each
// with its own form, per product decision to stop bundling ride and package
// concepts together on one Trip/Request row. Keep this list closed at 6
// actions; update the plan doc before adding a 7th. "Offer a Ride" and
// "Split an Uber/Lyft" both create a Trip, distinguished by
// Trip.category (see TripPostForm) -- they're the same underlying
// lifecycle (post → connect → confirm seat → message → complete → review),
// just different framing/fields. "Need a Ride" and "Need to Split an Uber"
// both create a Request the same way, via Request.category. "Offer Package
// Space" and "Need Something Delivered" both create a PackagePost,
// pre-selecting its `kind` (see PackagePostForm) -- a deliberately separate,
// minimal model with no seat/capacity lifecycle at all. `group` is purely
// presentational (see the two-panel layout below) -- it doesn't change any
// routing/query-param behavior. `weight` is also purely presentational --
// per product decision, package actions are the visually featured/primary
// option in each panel, Uber-sharing is secondary, and driving-your-own-car
// is the smallest/least emphasized -- see the post-hub-tile-${weight}
// classes in globals.css. All 6 actions remain equally functional; only
// visual prominence differs.
const POST_ACTIONS = [
  {
    key: "offer-ride",
    label: "Offer a Ride (my car)",
    href: "/post/trip?category=personal_car",
    group: "offer" as const,
    weight: "tertiary" as const,
  },
  {
    key: "offer-uber",
    label: "Split an Uber/Lyft",
    href: "/post/trip?category=uber_share",
    group: "offer" as const,
    weight: "secondary" as const,
  },
  {
    key: "offer-package",
    label: "Offer Package Space",
    href: "/post/package?kind=offering_space",
    group: "offer" as const,
    weight: "primary" as const,
  },
  {
    key: "need-ride",
    label: "Need a Ride",
    href: "/post/request?category=personal_car",
    group: "need" as const,
    weight: "tertiary" as const,
  },
  {
    key: "need-uber",
    label: "Need to Split an Uber",
    href: "/post/request?category=uber_share",
    group: "need" as const,
    weight: "secondary" as const,
  },
  {
    key: "need-delivery",
    label: "Need Something Delivered",
    href: "/post/package?kind=needing_delivery",
    group: "need" as const,
    weight: "primary" as const,
  },
];

const WEIGHT_ORDER = { primary: 0, secondary: 1, tertiary: 2 };

export default function PostPage() {
  const byWeight = (a: (typeof POST_ACTIONS)[number], b: (typeof POST_ACTIONS)[number]) =>
    WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight];
  const offerActions = POST_ACTIONS.filter((a) => a.group === "offer").sort(byWeight);
  const needActions = POST_ACTIONS.filter((a) => a.group === "need").sort(byWeight);

  return (
    <div>
      <span className="eyebrow">Post</span>
      <h1 className="heading-tight">What do you want to post?</h1>
      <div className="post-hub-groups">
        <div className="post-hub-panel">
          <h2 className="post-hub-panel-title">Offer</h2>
          <div className="post-hub-tiles">
            {offerActions.map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className={`post-hub-tile post-hub-tile-${action.weight}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="post-hub-divider" aria-hidden="true" />
        <div className="post-hub-panel">
          <h2 className="post-hub-panel-title">Need</h2>
          <div className="post-hub-tiles">
            {needActions.map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className={`post-hub-tile post-hub-tile-${action.weight}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <p className="post-hub-footer">
        <Link href="/my-posts" className="btn-secondary">
          View your posts
        </Link>
      </p>
    </div>
  );
}
