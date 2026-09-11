"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// "Post" is deliberately not in this list -- it's rendered as the primary
// "+ Post a trip" CTA button in the header instead of a tab (see
// src/app/layout.tsx), but /post itself is unchanged and still fully
// reachable.
const PRIMARY_TABS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/my-posts", label: "My Posts" },
  { href: "/connections", label: "Connections" },
  { href: "/messages", label: "Messages" },
  { href: "/profile", label: "Profile" },
];

// A Client Component specifically so the active-tab highlight uses
// usePathname() -- RootLayout (src/app/layout.tsx) is a Server Component
// that reads the pathname once via a request header, but Next's App Router
// doesn't re-run a layout on a client-side <Link> navigation that stays
// under the same layout (the same caveat already documented there for the
// parent-link gate), so a Server-Component-only version of this nav would
// highlight whichever tab was active on the very first full page load and
// never update again. usePathname() is the one hook that does track
// client-side navigation correctly.
export function NavTabs({ unreadConversationCount }: { unreadConversationCount: number }) {
  const pathname = usePathname();
  const isActiveTab = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href) ?? false;

  return (
    <nav className="site-nav-tabs">
      {PRIMARY_TABS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={
            isActiveTab(item.href) ? "site-nav-tab site-nav-tab-active" : "site-nav-tab"
          }
        >
          {item.label}
          {item.href === "/messages" && unreadConversationCount > 0 && (
            <span className="nav-badge">{unreadConversationCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
