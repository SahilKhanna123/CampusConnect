import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser, universityBadgeLabel } from "@/lib/auth";

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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <span className="site-title">CampusConnect</span>
          <span className="site-auth-status">
            {user ? (
              <>
                {user.name}
                {" · "}
                {universityBadgeLabel(user) ?? (
                  <Link href="/verify">Verify your university email</Link>
                )}
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
