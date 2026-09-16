// Great-circle distance between two lat/lng points via the haversine
// formula, in miles. Postgres here has no PostGIS and no other geo need in
// this codebase uses raw SQL (see src/lib/geocode.ts) -- this follows that
// same pure-JS precedent rather than a database-level distance query. Used
// to sort Home's signed-in feed by proximity to the viewer's home city.
const EARTH_RADIUS_MILES = 3958.8;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}
