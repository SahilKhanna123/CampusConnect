"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ExploreCard, type ExploreCardPost } from "@/components/ExploreCard";

// RouteMap (Leaflet) touches `window`/`document` as soon as its module
// loads, which breaks server-side rendering -- ssr: false defers loading it
// until the browser, same as any other Leaflet-in-Next.js integration.
const RouteMap = dynamic(
  () => import("@/components/RouteMap").then((mod) => mod.RouteMap),
  { ssr: false },
);

// Client wrapper around the results grid + real route map on /explore. The
// page itself stays a server component (data-fetching and the filter <form>
// are unchanged, plain server-rendered GET navigation) -- this only owns the
// hover-linking state between a trip card and its route on the map.
export function ExploreMapView({
  posts,
  isLoggedIn,
  emptyMessage = "No trips match your filters right now.",
}: {
  posts: ExploreCardPost[];
  isLoggedIn: boolean;
  // Explore's view toggle (All/Rides/Packages) means an empty grid can mean
  // three different things -- the caller passes the message that matches
  // whichever category is actually being browsed, rather than this
  // component guessing from the post list (which is empty either way).
  emptyMessage?: string;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  if (posts.length === 0) {
    return (
      <div className="explore-panel">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    // A light gray "panel" backdrop (per a reference mockup) so the white
    // cards and the map both read as distinct, breathing-room'd elements
    // rather than floating directly on the page's own white background --
    // purely a container/spacing change, same grid+map structure inside.
    <div className="explore-panel">
      <div className="explore-split">
        <div className="explore-grid">
          {posts.map((post) => {
            const key = `${post.kind}-${post.id}`;
            return (
              <div
                key={key}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() =>
                  setHoveredKey((current) => (current === key ? null : current))
                }
              >
                <ExploreCard post={post} isLoggedIn={isLoggedIn} />
              </div>
            );
          })}
        </div>
        <RouteMap posts={posts} hoveredKey={hoveredKey} />
      </div>
    </div>
  );
}
