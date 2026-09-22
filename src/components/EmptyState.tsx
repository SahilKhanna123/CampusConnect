import type { ReactNode } from "react";

// A Tailwind-styled "nothing here" block for list pages that previously
// rendered a bare <p>. Deliberately re-implements the same visual language
// as the existing plain-CSS .empty-state/.empty-state-actions rule in
// globals.css (used by not-found.tsx and Home's two "nothing nearby"
// sections) rather than inventing a second "empty" look -- a viewer who
// hits a 404 and an empty inbox in the same session should recognize both
// as the same kind of state. Those existing usages aren't swapped to this
// component here; only the newly-touched list pages are.
export function EmptyState({
  icon,
  heading,
  children,
  action,
}: {
  // A single emoji, matching this app's existing emoji-as-icon convention
  // (🎓, 📦, 🎫) rather than pulling in an icon library for one component.
  icon?: ReactNode;
  heading?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 py-8 text-gray-body">
      {icon && (
        <div className="text-2xl" aria-hidden="true">
          {icon}
        </div>
      )}
      {heading && <h2 className="m-0 text-base font-semibold text-black">{heading}</h2>}
      <p className="m-0">{children}</p>
      {action && <div className="flex flex-wrap gap-3">{action}</div>}
    </div>
  );
}
