"use client";

import { useState } from "react";
import { ExploreCard, type ExploreCardPost } from "@/components/ExploreCard";
import { SchematicMap } from "@/components/SchematicMap";

// Client wrapper around the results grid + schematic map on /explore. The
// page itself stays a server component (data-fetching and the filter <form>
// are unchanged, plain server-rendered GET navigation) -- this only owns the
// hover-linking state between a trip/request card and its route on the map.
// Keyed on the same `${kind}-${id}` composite already used everywhere else
// in this codebase (JSX keys, connectionStatusByTripId), not a bare post id
// -- a Trip and a Request live in separate id spaces and could otherwise
// collide and cross-highlight.
export function ExploreMapView({
  posts,
  isLoggedIn,
}: {
  posts: ExploreCardPost[];
  isLoggedIn: boolean;
}) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  if (posts.length === 0) {
    return <p>No trips or ride requests match your filters right now.</p>;
  }

  return (
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
      <SchematicMap posts={posts} hoveredKey={hoveredKey} />
    </div>
  );
}
