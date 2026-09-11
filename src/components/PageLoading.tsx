// Shared shell for every route's loading.tsx -- keeps the loading state
// visually identical everywhere instead of duplicating the same markup in
// each route's own loading.tsx (see PageError for the equivalent pattern).
export function PageLoading({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="empty-state">
      <span className="eyebrow">{title}</span>
      <p>{message}</p>
    </div>
  );
}
