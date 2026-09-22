"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap } from "react-leaflet";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ExploreCardPost } from "@/components/ExploreCard";

// A real map (real geocoded coordinates via OpenStreetMap's Nominatim, no
// API key/billing required -- see src/lib/geocode.ts) replacing the old
// illustrative SchematicMap -- per product decision, the hash-positioned
// placeholder didn't look realistic. Every origin/destination that made it
// this far already has real coordinates resolved server-side (see
// src/app/explore/page.tsx and src/app/page.tsx): a City's own
// City.latitude/longitude when backfilled, or a Nominatim geocode-and-cache
// lookup otherwise (covers a write-in Trip.destinationText too, e.g.
// "SFO Airport"). A post whose origin or destination couldn't be resolved
// (Nominatim found nothing, or the network call failed) is simply not
// plotted -- omitted, not guessed, same precedent this app uses elsewhere
// for incomplete data.
//
// The tile layer was briefly dropped in favor of a plain grid canvas (per
// an earlier reference mockup that had no real tile imagery), then
// reinstated after live feedback that the grid-only version read as "blank
// boxes" rather than an actual map -- the standard OpenStreetMap raster
// tiles are back, muted via the .route-map-tiles CSS filter (grayscale +
// reduced saturation/contrast) for a clean look without depending on a
// third-party basemap. CARTO's free Positron tiles were tried once before
// for the same clean look and turned out to now require an API key -- this
// filter-on-standard-OSM-tiles approach is what avoids that dependency risk
// while still not looking like the busy default OSM palette.
//
// CircleMarker (a plain SVG-drawn dot), not the default Leaflet pin Marker
// -- the default pin needs bundler-specific workarounds for its icon image
// assets (a well-known Leaflet+webpack/Next.js gotcha) that a plain circle
// sidesteps entirely, and a small dot matches this app's existing flat
// visual language better than a literal map pin anyway.
// MapContainer's own initial center/zoom, before FitBounds' effect (below)
// runs on mount and re-fits to whatever coordinates actually resolved --
// a rough Bay Area <-> Irvine midpoint, wide enough to show the whole
// state, so that inert first frame is never Leaflet's own [0,0]/zoom-0
// world view. In practice `points[0]` (the value this used to default to)
// is already a real resolved coordinate by the time MapContainer mounts,
// so this is defensive polish, not a fix for an observed bug.
const CALIFORNIA_FALLBACK_CENTER: [number, number] = [35.5, -119.5];
const CALIFORNIA_FALLBACK_ZOOM = 6;

type PlottablePost = ExploreCardPost & {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
};

function isPlottable(post: ExploreCardPost): post is PlottablePost {
  const p = post as Partial<PlottablePost>;
  return (
    typeof p.originLat === "number" &&
    typeof p.originLng === "number" &&
    typeof p.destinationLat === "number" &&
    typeof p.destinationLng === "number"
  );
}

// Fits the map's viewport to `points` (all markers by default, or just the
// hovered route's two endpoints -- see the caller) whenever that set
// changes -- a child of MapContainer so it can reach the map instance via
// useMap() (React state can't reach into Leaflet's own imperative map
// object any other way). Re-scoping to the hovered route specifically (not
// always "every point on the page") matters in practice, not just for
// polish: one geographically distant outlier among many posts -- a garbled
// destination name Nominatim happened to match somewhere far away -- would
// otherwise force the whole map to zoom out so far that a real, nearby
// route hovered by the user shrinks to an invisible sliver.
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }
    map.fitBounds(points, { padding: [32, 32], maxZoom: 12 });
  }, [map, points]);
  return null;
}

// The "moving dot along a line" motif shelved when the Home hero moved from
// an animated SVG illustration to a static one (see the comment on
// HomeHeroIllustration, src/app/page.tsx) -- it didn't read as meaningful
// without a real route to anchor it to. This is that route: a dot that
// travels the hovered post's line back and forth, indicating direction of
// travel. Leaflet has no SVG <animateMotion> equivalent, so this animates
// imperatively via requestAnimationFrame + CircleMarker's own setLatLng(),
// bypassing React's render cycle entirely -- re-rendering a React tree every
// animation frame would be both unnecessary and visibly less smooth than
// Leaflet just moving the existing marker in place.
function FlowingDot({ from, to }: { from: [number, number]; to: [number, number] }) {
  const markerRef = useRef<LeafletCircleMarker>(null);

  useEffect(() => {
    const durationMs = 2600;
    const start = performance.now();
    let frameId: number;

    function tick(now: number) {
      const elapsed = (now - start) % durationMs;
      // Ease in/out (rather than a linear crawl) so the dot's motion reads
      // as deliberate travel, not a mechanical tween -- a simple cosine
      // easing, cheap enough to run every frame.
      const linear = elapsed / durationMs;
      const eased = (1 - Math.cos(linear * Math.PI)) / 2;
      const lat = from[0] + (to[0] - from[0]) * eased;
      const lng = from[1] + (to[1] - from[1]) * eased;
      markerRef.current?.setLatLng([lat, lng]);
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [from, to]);

  return (
    <CircleMarker
      ref={markerRef}
      center={from}
      radius={4.5}
      pathOptions={{
        color: "#ffffff",
        weight: 1.5,
        fillColor: "#1D6FFF",
        fillOpacity: 1,
        className: "route-map-flow-dot",
      }}
    />
  );
}

export function RouteMap({
  posts,
  hoveredKey,
}: {
  posts: ExploreCardPost[];
  hoveredKey: string | null;
}) {
  const plottable = posts.filter(isPlottable);

  // One marker per unique city/place, even if several posts share it (e.g.
  // several trips all originating in Fremont) -- keyed by rounded
  // coordinates + name so the same place from two different posts collapses
  // to a single dot instead of stacking duplicates. The key format
  // (`lat.toFixed(4),lng.toFixed(4)`) is also how the hovered route's own
  // origin/destination are looked up below, so the two stay in sync.
  const markers = new Map<string, { lat: number; lng: number; name: string }>();
  for (const post of plottable) {
    const originKey = `${post.originLat.toFixed(4)},${post.originLng.toFixed(4)}`;
    if (!markers.has(originKey)) {
      markers.set(originKey, { lat: post.originLat, lng: post.originLng, name: post.originName });
    }
    const destKey = `${post.destinationLat.toFixed(4)},${post.destinationLng.toFixed(4)}`;
    if (!markers.has(destKey)) {
      markers.set(destKey, {
        lat: post.destinationLat,
        lng: post.destinationLng,
        name: post.destinationName,
      });
    }
  }

  // Fit to just the hovered route's two endpoints when one is hovered,
  // rather than every point on the page -- see FitBounds' own comment for
  // why (an outlier elsewhere shouldn't zoom out a route the user is
  // actively looking at into invisibility).
  const hoveredPost = plottable.find((post) => `${post.kind}-${post.id}` === hoveredKey);
  const points: [number, number][] = hoveredPost
    ? [
        [hoveredPost.originLat, hoveredPost.originLng],
        [hoveredPost.destinationLat, hoveredPost.destinationLng],
      ]
    : [...markers.values()].map((m) => [m.lat, m.lng]);

  // The hovered route's two marker keys -- every other marker on the page
  // renders as a small, muted "ambient" dot (matching the reference
  // mockup's unrelated-city dots), while these two get the mockup's
  // green-ring-origin / filled-blue-destination treatment plus a bolder
  // label, so the highlighted route reads clearly against the rest.
  const hoveredOriginKey = hoveredPost
    ? `${hoveredPost.originLat.toFixed(4)},${hoveredPost.originLng.toFixed(4)}`
    : null;
  const hoveredDestKey = hoveredPost
    ? `${hoveredPost.destinationLat.toFixed(4)},${hoveredPost.destinationLng.toFixed(4)}`
    : null;

  if (plottable.length === 0) {
    return (
      <div className="schematic-map schematic-map-empty">
        <p>No route locations to show yet.</p>
      </div>
    );
  }

  return (
    <div className="schematic-map">
      <div className="eyebrow schematic-map-eyebrow">Campus Routes</div>
      <MapContainer
        center={CALIFORNIA_FALLBACK_CENTER}
        zoom={CALIFORNIA_FALLBACK_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%", borderRadius: "12px" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="route-map-tiles"
        />
        <FitBounds points={points} />
        {plottable.map((post) => {
          const key = `${post.kind}-${post.id}`;
          const isHovered = key === hoveredKey;
          const isDimmed = hoveredKey !== null && !isHovered;
          return (
            <Polyline
              key={key}
              positions={[
                [post.originLat, post.originLng],
                [post.destinationLat, post.destinationLng],
              ]}
              pathOptions={{
                color: isHovered ? "#1D6FFF" : "#9ca3af",
                weight: isHovered ? 5 : 2,
                dashArray: isHovered ? undefined : "1 8",
                lineCap: "round",
                opacity: isDimmed ? 0.25 : isHovered ? 1 : 0.8,
                className: isHovered ? "route-map-line-hovered" : undefined,
              }}
            />
          );
        })}
        {hoveredPost && (
          <FlowingDot
            from={[hoveredPost.originLat, hoveredPost.originLng]}
            to={[hoveredPost.destinationLat, hoveredPost.destinationLng]}
          />
        )}
        {[...markers.entries()].map(([key, marker]) => {
          const isOrigin = key === hoveredOriginKey;
          const isDestination = key === hoveredDestKey;
          const pathOptions = isOrigin
            ? {
                color: "#16a34a",
                weight: 2.5,
                fillColor: "#ffffff",
                fillOpacity: 1,
                className: "route-map-marker-origin",
              }
            : isDestination
              ? {
                  color: "#ffffff",
                  weight: 2,
                  fillColor: "#1D6FFF",
                  fillOpacity: 1,
                  className: "route-map-marker-destination",
                }
              : {
                  color: "#9ca3af",
                  weight: 1.5,
                  fillColor: "#ffffff",
                  fillOpacity: 1,
                  className: "route-map-marker-dim",
                };
          return (
            <CircleMarker
              key={key}
              center={[marker.lat, marker.lng]}
              radius={isOrigin || isDestination ? 7 : 4}
              pathOptions={pathOptions}
            >
              <Tooltip
                permanent
                direction="right"
                offset={[8, 0]}
                opacity={1}
                className={
                  isOrigin || isDestination
                    ? "route-map-marker-label-active"
                    : "route-map-marker-label"
                }
              >
                {marker.name}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
