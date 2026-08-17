import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import {
  getCurrentUser,
  universityBadgeLabel,
  parentRelationshipBadgeLabel,
  hasLinkedStudent,
  hasCompletedOnboarding,
} from "@/lib/auth";

export const metadata: Metadata = {
  title: "CampusConnect",
  description:
    "A trusted community marketplace connecting students, parents, alumni, and travelers between home and college.",
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/explore", label: "Explore" },
  { href: "/post", label: "Post" },
  { href: "/messages", label: "Messages" },
  { href: "/profile", label: "Profile" },
];

// A parent-signup account can't use the rest of the app until they've
// linked at least one student via OTP -- per product decision, this
// mirrors how university verification gates a student account. This is the
// ONE page a gated parent can still reach; every other page redirects here.
const PARENT_LINK_GATE_EXEMPT_PATH = "/family/connect-student";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const pathname = (await headers()).get("x-pathname");

  if (user?.signedUpAsParent && !hasLinkedStudent(user)) {
    if (pathname !== PARENT_LINK_GATE_EXEMPT_PATH) {
      redirect(PARENT_LINK_GATE_EXEMPT_PATH);
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
    pathname !== PARENT_LINK_GATE_EXEMPT_PATH;

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <span className="site-title">CampusConnect</span>
          <span className="site-auth-status">
            {user ? (
              <>
                {user.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoUrl}
                    alt=""
                    width={24}
                    height={24}
                    style={{
                      borderRadius: "50%",
                      verticalAlign: "middle",
                      marginRight: "0.375rem",
                      objectFit: "cover",
                    }}
                  />
                )}
                {user.name}
                {" · "}
                {universityBadgeLabel(user) ??
                  parentRelationshipBadgeLabel(user) ??
                  // A parent account never has its own university email to
                  // verify (see parentRelationshipBadgeLabel above) -- the
                  // self-serve /verify flow is for students/alumni/travelers
                  // only, so don't nudge a parent toward it.
                  (!user.signedUpAsParent && (
                    <Link href="/verify">Verify your university email</Link>
                  ))}
                {" · "}
                <form action="/api/auth/signout" method="post" style={{ display: "inline" }}>
                  <button type="submit" className="site-auth-link">
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                {" · "}
                <Link href="/sign-up">Sign up</Link>
              </>
            )}
          </span>
        </header>
        {showOnboardingNudge && (
          <p className="onboarding-nudge">
            <Link href="/onboarding">Finish setting up your profile</Link>
          </p>
        )}
        <main className="site-main">{children}</main>
        <nav className="site-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="site-nav-item">
              {item.label}
            </Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
