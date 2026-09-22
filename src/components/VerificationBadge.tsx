import type { ReactNode } from "react";

function CheckIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M13.5 4.5 6 12 2.5 8.5l1-1L6 10l6.5-6.5z" />
    </svg>
  );
}

function UnverifiedIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

// A verified / not-yet-verified pill, shared by the public profile page
// (one per VerificationRecord type, a short fixed label) and the self
// profile page (one longer derived label, e.g. "Verified Parent of UC
// Irvine Student", already fully composed by universityBadgeLabel/
// parentRelationshipBadgeLabel in src/lib/auth.ts) -- takes its text as
// children rather than composing it internally, since those two callers'
// label shapes aren't uniform enough to generate from a single noun prop.
// The "not verified" look is opt-in at the call site: it only makes sense
// where a viewer actually has a self-serve fix (email/university ->
// /verify), so a parent-relationship or identity badge has no "not
// verified" rendering anywhere -- those callers simply don't render this
// component at all when unverified, rather than passing some suppression
// flag into it.
export function VerificationBadge({
  verified,
  children,
}: {
  verified: boolean;
  children: ReactNode;
}) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-bg px-2 py-0.5 text-[11px] font-bold text-green">
      <CheckIcon />
      {children}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-section px-2 py-0.5 text-[11px] font-semibold text-gray-meta">
      <UnverifiedIcon />
      {children}
    </span>
  );
}
