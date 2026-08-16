import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <span className="site-title">CampusConnect</span>
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
