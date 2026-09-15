import { prisma } from "@/lib/prisma";

export type Coordinates = { lat: number; lng: number };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
// Nominatim's usage policy requires a valid identifying User-Agent (or
// Referer) on every request -- this can only be set server-side (a browser
// fetch() can't override its own User-Agent header), which is one reason
// this whole module runs server-side only, never from the client.
const USER_AGENT = "CampusConnect/1.0 (student ride-share marketplace, contact via app)";

// Resolves a free-text place name (e.g. a City.name, or a write-in
// Trip/PackagePost.destinationText like "SFO Airport") to real-world
// coordinates via OpenStreetMap's Nominatim geocoder, backed by
// GeocodeCache (prisma/schema.prisma) so the same place is never
// re-resolved twice -- both for our own performance and because Nominatim's
// public instance caps usage at roughly 1 request/second and expects
// callers to cache results rather than re-querying them. Returns null if
// the text is empty or Nominatim can't find a match, rather than throwing
// -- a place the Explore route map can't plot just gets skipped (see
// RouteMap.tsx), the same "omit rather than guess" precedent this app
// already uses elsewhere for incomplete data.
export async function resolveCoordinates(name: string): Promise<Coordinates | null> {
  const query = name.trim().toLowerCase();
  if (!query) return null;

  const cached = await prisma.geocodeCache.findUnique({ where: { query } });
  if (cached) return { lat: cached.latitude, lng: cached.longitude };

  let response: Response;
  try {
    response = await fetch(
      `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(name)}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
  } catch {
    // Network failure (Nominatim down, offline dev environment, etc.) --
    // not cached, so a later request can retry rather than being stuck with
    // a permanently-wrong cached failure.
    return null;
  }
  if (!response.ok) return null;

  const results = (await response.json()) as { lat: string; lon: string }[];
  if (results.length === 0) return null;

  const lat = parseFloat(results[0].lat);
  const lng = parseFloat(results[0].lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  await prisma.geocodeCache.upsert({
    where: { query },
    create: { query, latitude: lat, longitude: lng },
    update: { latitude: lat, longitude: lng },
  });
  return { lat, lng };
}

// Coordinates for a City row -- City.latitude/longitude is a fast-path cache
// (populated for the seeded cities in prisma/seed.ts) that skips the
// Nominatim round trip entirely when present; falls back to
// resolveCoordinates(city.name) for any City that hasn't been backfilled yet
// (e.g. one created after launch).
export function getCityCoordinates(city: {
  name: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<Coordinates | null> {
  if (city.latitude !== null && city.longitude !== null) {
    return Promise.resolve({ lat: city.latitude, lng: city.longitude });
  }
  return resolveCoordinates(city.name);
}

// Resolves coordinates for a batch of distinct place names in one pass,
// sequentially rather than in parallel (Promise.all) -- Nominatim's public
// instance rate-limits at roughly 1 request/second, and firing several
// lookups at once for a single page render would violate that. Names
// already covered by GeocodeCache (or that resolveCoordinates otherwise
// short-circuits) don't add meaningful latency here; only genuinely new
// place names pay the sequential cost.
export async function resolveManyCoordinates(
  names: string[],
): Promise<Map<string, Coordinates>> {
  const uniqueNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const result = new Map<string, Coordinates>();
  for (const name of uniqueNames) {
    const coords = await resolveCoordinates(name);
    if (coords) result.set(name.trim().toLowerCase(), coords);
  }
  return result;
}

type CityLike = { name: string; latitude: number | null; longitude: number | null };
type GeocodablePost = {
  originCity: CityLike | null;
  destinationCity: CityLike | null;
  destinationText: string | null;
};
export type PostCoordinates = {
  originLat: number | null;
  originLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
};

// Resolves origin/destination coordinates for a batch of already-fetched
// Trip or PackagePost rows in one pass -- used by /explore and Home (both
// the signed-in feed and the logged-out preview) so the Explore route map
// (RouteMap.tsx) can plot real positions. Every write-in destinationText
// across the whole batch is deduped and resolved together via
// resolveManyCoordinates (the one place Nominatim's rate limit actually
// matters here); a destination or origin backed by a City almost always
// resolves instantly from City.latitude/longitude (see getCityCoordinates)
// with no network call at all. Keyed by object identity (the exact row
// objects passed in), which works cleanly across Trip and PackagePost's
// different shapes without needing a synthetic id.
export async function resolvePostCoordinates<T extends GeocodablePost>(
  items: T[],
): Promise<Map<T, PostCoordinates>> {
  const freeTextNames = items
    .filter((item) => !item.destinationCity && item.destinationText)
    .map((item) => item.destinationText as string);
  const freeTextCoords = await resolveManyCoordinates(freeTextNames);

  const result = new Map<T, PostCoordinates>();
  for (const item of items) {
    const origin = item.originCity ? await getCityCoordinates(item.originCity) : null;
    const destination = item.destinationCity
      ? await getCityCoordinates(item.destinationCity)
      : item.destinationText
        ? (freeTextCoords.get(item.destinationText.trim().toLowerCase()) ?? null)
        : null;
    result.set(item, {
      originLat: origin?.lat ?? null,
      originLng: origin?.lng ?? null,
      destinationLat: destination?.lat ?? null,
      destinationLng: destination?.lng ?? null,
    });
  }
  return result;
}
