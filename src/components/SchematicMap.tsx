"use client";

import type { ExploreCardPost } from "@/components/ExploreCard";

// Schematic (not geographic) positions for the cities seeded by
// prisma/seed.ts, keyed by exact City.name. Deliberately illustrative, not
// a real map -- the schema has no lat/lng (see the City model in
// prisma/schema.prisma) and City is intentionally open-ended (any city, e.g.
// an airport, can be attached to a Trip/Request per the plan doc), so this
// can never cover every possible city. Any city not in this table gets a
// deterministic fallback position derived from a hash of its name, so the
// map never crashes or silently drops a route -- it just won't be
// geographically meaningful for that one city, which is fine for a purely
// illustrative browsing aid.
const KNOWN_CITY_POSITIONS: Record<string, { x: number; y: number }> = {
  "San Francisco": { x: 30, y: 40 },
  Oakland: { x: 55, y: 55 },
  "San Ramon": { x: 80, y: 70 },
  Fremont: { x: 70, y: 90 },
  "Palo Alto": { x: 40, y: 100 },
  "San Jose": { x: 60, y: 120 },
  Irvine: { x: 250, y: 200 },
};

function positionFor(cityName: string): { x: number; y: number } {
  const known = KNOWN_CITY_POSITIONS[cityName];
  if (known) return known;
  let hash = 0;
  for (const ch of cityName) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return { x: 20 + (hash % 260), y: 20 + ((hash >> 8) % 200) };
}

export function SchematicMap({
  posts,
  hoveredKey,
}: {
  posts: ExploreCardPost[];
  hoveredKey: string | null;
}) {
  const routes = posts.map((p) => ({
    key: `${p.kind}-${p.id}`,
    from: positionFor(p.originName),
    to: positionFor(p.destinationName),
  }));

  const cityLabels = new Map<string, { x: number; y: number }>();
  for (const p of posts) {
    cityLabels.set(p.originName, positionFor(p.originName));
    cityLabels.set(p.destinationName, positionFor(p.destinationName));
  }

  return (
    <div className="schematic-map">
      <svg viewBox="0 0 300 240" width="100%" height="100%">
        {routes.map((r) => {
          const isHovered = r.key === hoveredKey;
          const isDimmed = hoveredKey !== null && !isHovered;
          const path = `M${r.from.x},${r.from.y} L${r.to.x},${r.to.y}`;
          return (
            <g key={r.key} opacity={isDimmed ? 0.25 : 1}>
              <path
                d={path}
                stroke={isHovered ? "#1D6FFF" : "#c7c7c7"}
                strokeWidth={isHovered ? 2.5 : 1.5}
                strokeDasharray={isHovered ? undefined : "4 3"}
                fill="none"
              />
              {isHovered && (
                <circle r="3.5" fill="#1D6FFF">
                  <animateMotion dur="2s" repeatCount="indefinite" path={path} />
                </circle>
              )}
            </g>
          );
        })}
        {Array.from(cityLabels.entries()).map(([name, pos]) => (
          <g key={name}>
            <circle cx={pos.x} cy={pos.y} r="3" fill="#000000" />
            <text x={pos.x + 5} y={pos.y + 3} fontSize="7" fill="#6b6b6b">
              {name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
