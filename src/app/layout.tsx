import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import "./tailwind.css";
import {
  getCurrentUser,
  universityBadgeLabel,
  parentRelationshipBadgeLabel,
  hasLinkedStudent,
  hasCompletedOnboarding,
} from "@/lib/auth";
import { getUnreadConversationCount } from "@/lib/messaging";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { NavTabs } from "@/components/NavTabs";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "CampusConnect",
  description:
    "A trusted community marketplace connecting students, parents, alumni, and travelers between home and college.",
};

// A parent-signup account can't use the rest of the app until they've
// linked at least one student via OTP -- per product decision, this
// mirrors how university verification gates a student account. These are
// the ONLY pages a gated parent can still reach; every other page redirects
// to the first one. /family/invite/accept is exempt for the same reason:
// accepting a student-sent invite (see POST /api/family/invite/accept) is
// an equally valid way to satisfy "has linked a student" as the OTP flow --
// without this, a parent who signed up specifically to accept an invite
// would get bounced to the OTP wizard before ever reaching the accept page.
const PARENT_LINK_GATE_EXEMPT_PATHS = [
  "/family/connect-student",
  "/family/invite/accept",
];

// A short second line under the user's name in the header, e.g. "UC Irvine ·
// Junior" for a verified student, "UC Irvine" alone if no year is set, or the
// user's home city for anyone without a university affiliation (parent,
// alumni, unverified traveler). Purely cosmetic -- never used for any
// verification/authorization decision, those stay on isUniversityVerified/
// universityBadgeLabel etc.
function headerSubtitle(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const universityName = user.studentRecord?.universityDomain?.universityName;
  if (universityName) {
    return user.year ? `${universityName} · ${user.year}` : universityName;
  }
  return user.homeCity?.name ?? null;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const pathname = (await headers()).get("x-pathname");

  if (user?.signedUpAsParent && !hasLinkedStudent(user)) {
    if (!pathname || !PARENT_LINK_GATE_EXEMPT_PATHS.includes(pathname)) {
      redirect(PARENT_LINK_GATE_EXEMPT_PATHS[0]);
    }
  }

  // Soft nudge, not a gate: unlike the parent-link check above, this never
  // redirects -- it just links to /onboarding from a banner when the
  // current page isn't already part of onboarding. See
  // hasCompletedOnboarding in src/lib/auth.ts.
  const showOnboardingNudge =
    !!user &&
    !hasCompletedOnboarding(user) &&
    pathname !== "/onboarding" &&
    !!pathname &&
    !PARENT_LINK_GATE_EXEMPT_PATHS.includes(pathname);

  // Powers the badge next to "Messages" below -- see src/lib/messaging.ts.
  const unreadConversationCount = user
    ? await getUnreadConversationCount(user.id)
    : 0;
  // Powers the badge on the bell icon in the header below -- see src/lib/notifications.ts.
  // Deliberately a separate count from unreadConversationCount above, not a
  // merged total: an accepted/declined connection request has no
  // corresponding "unread conversation" state at all, so folding the two
  // together would either double-count new-message notifications or hide
  // connection-request notifications from the badge entirely.
  const unreadNotificationCount = user
    ? await getUnreadNotificationCount(user.id)
    : 0;

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <header className="site-header">
          <div className="site-header-left">
            <Link href="/" className="site-logo">
              <span className="site-logo-mark" aria-hidden="true" />
              <span className="site-title">CampusConnect</span>
            </Link>
            {user && <NavTabs unreadConversationCount={unreadConversationCount} />}
          </div>
          <div className="site-header-right">
            {user ? (
              <>
                <Link href="/post" className="btn-primary site-post-cta">
                  + Post
                </Link>
                <Link
                  href="/notifications"
                  className="notification-bell"
                  aria-label={
                    unreadNotificationCount > 0
                      ? `Notifications (${unreadNotificationCount} unread)`
                      : "Notifications"
                  }
                >
                  🔔
                  {unreadNotificationCount > 0 && (
                    <span className="notification-bell-badge">
                      {unreadNotificationCount}
                    </span>
                  )}
                </Link>
                <div className="site-user">
                  {user.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="avatar-circle site-user-avatar"
                    />
                  ) : (
                    <span className="avatar-circle site-user-avatar" aria-hidden="true">
                      {user.name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <div className="site-user-name">{user.name}</div>
                    {headerSubtitle(user) && (
                      <div className="site-user-subtitle">{headerSubtitle(user)}</div>
                    )}
                  </div>
                </div>
                <span className="site-auth-status-verify">
                  {universityBadgeLabel(user) ??
                    parentRelationshipBadgeLabel(user) ??
                    // A parent account never has its own university email to
                    // verify (see parentRelationshipBadgeLabel above) -- the
                    // self-serve /verify flow is for students/alumni/travelers
                    // only, so don't nudge a parent toward it.
                    (!user.signedUpAsParent && (
                      <Link href="/verify">Verify email</Link>
                    ))}
                </span>
                <form action="/api/auth/signout" method="post" style={{ display: "inline" }}>
                  <button type="submit" className="site-auth-link">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <span className="site-auth-status">
                <Link href="/login">Log in</Link>
                {" · "}
                <Link href="/sign-up">Sign up</Link>
              </span>
            )}
          </div>
        </header>
        {showOnboardingNudge && (
          <p className="onboarding-nudge">
            <Link href="/onboarding">Finish setting up your profile</Link>
          </p>
        )}
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
