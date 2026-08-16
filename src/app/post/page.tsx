// Post — the four core actions. Keep this list closed per MVP scope;
// do not add a fifth action without updating the plan doc first.
// TODO: each option routes to a create-Trip or create-Request form.

const POST_ACTIONS = [
  { key: "offer-ride", label: "Offer a Ride" },
  { key: "need-ride", label: "Need a Ride" },
  { key: "offer-package", label: "Offer Package Space" },
  { key: "need-delivery", label: "Need Something Delivered" },
];

export default function PostPage() {
  return (
    <div>
      <h1>Post</h1>
      <ul>
        {POST_ACTIONS.map((action) => (
          <li key={action.key}>{action.label}</li>
        ))}
      </ul>
    </div>
  );
}
