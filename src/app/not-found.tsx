import Link from "next/link";

// Next.js App Router convention: the app-wide fallback for notFound() calls
// (e.g. /trips/[id], /requests/[id]) that don't hit a more specific
// not-found.tsx of their own, and for any URL that matches no route at all.
// Renders inside the root layout, so the header/nav still show.
export default function NotFound() {
  return (
    <div className="empty-state">
      <span className="eyebrow">404</span>
      <h1 className="heading-tight">Page not found</h1>
      <p>The page you&apos;re looking for doesn&apos;t exist or may have been removed.</p>
      <div className="empty-state-actions">
        <Link href="/" className="btn-primary">
          Go home
        </Link>
        <Link href="/explore" className="btn-secondary">
          Explore trips
        </Link>
      </div>
    </div>
  );
}
