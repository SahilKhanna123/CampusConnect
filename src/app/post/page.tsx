import Link from "next/link";

// Post — the four core actions. Keep this list closed per MVP scope; do not
// add a fifth action without updating the plan doc first. All four route
// into just two forms: "Offer a Ride" / "Offer Package Space" both create a
// Trip (they're both attributes of the same journey -- see
// TripPostForm/packageSpaceAvailable); "Need a Ride" / "Need Something
// Delivered" both create a Request, pre-selecting Request.type via the
// query param RequestPostForm reads. `group` is purely presentational (see
// the two-panel layout below) -- it doesn't change any routing/query-param
// behavior.
const POST_ACTIONS = [
  { key: "offer-ride", label: "Offer a Ride", href: "/post/trip", group: "offer" as const },
  {
    key: "offer-package",
    label: "Offer Package Space",
    href: "/post/trip?package=true",
    group: "offer" as const,
  },
  {
    key: "need-ride",
    label: "Need a Ride",
    href: "/post/request?type=ride",
    group: "need" as const,
  },
  {
    key: "need-delivery",
    label: "Need Something Delivered",
    href: "/post/request?type=package",
    group: "need" as const,
  },
];

export default function PostPage() {
  const offerActions = POST_ACTIONS.filter((a) => a.group === "offer");
  const needActions = POST_ACTIONS.filter((a) => a.group === "need");

  return (
    <div>
      <span className="eyebrow">Post</span>
      <h1 className="heading-tight">What do you want to post?</h1>
      <div className="post-hub-groups">
        <div className="post-hub-panel">
          <h2 className="post-hub-panel-title">Offer</h2>
          <div className="post-hub-tiles">
            {offerActions.map((action) => (
              <Link key={action.key} href={action.href} className="post-hub-tile">
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
              <Link key={action.key} href={action.href} className="post-hub-tile">
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
      <p>
        <Link href="/my-posts">View your posts</Link>
      </p>
    </div>
  );
}
