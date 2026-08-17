import Link from "next/link";

// Post — the four core actions. Keep this list closed per MVP scope; do not
// add a fifth action without updating the plan doc first. All four route
// into just two forms: "Offer a Ride" / "Offer Package Space" both create a
// Trip (they're both attributes of the same journey -- see
// TripPostForm/packageSpaceAvailable); "Need a Ride" / "Need Something
// Delivered" both create a Request, pre-selecting Request.type via the
// query param RequestPostForm reads.
const POST_ACTIONS = [
  { key: "offer-ride", label: "Offer a Ride", href: "/post/trip" },
  {
    key: "offer-package",
    label: "Offer Package Space",
    href: "/post/trip?package=true",
  },
  { key: "need-ride", label: "Need a Ride", href: "/post/request?type=ride" },
  {
    key: "need-delivery",
    label: "Need Something Delivered",
    href: "/post/request?type=package",
  },
];

export default function PostPage() {
  return (
    <div>
      <h1>Post</h1>
      <ul>
        {POST_ACTIONS.map((action) => (
          <li key={action.key}>
            <Link href={action.href}>{action.label}</Link>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/my-posts">View your posts</Link>
      </p>
    </div>
  );
}
