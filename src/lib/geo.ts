import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth";

/** Cities grouped by Region, for populating the home-area picker. */
export async function getCitiesByRegion() {
  const regions = await prisma.region.findMany({
    include: { cities: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return regions
    .filter((region) => region.cities.length > 0)
    .map((region) => ({
      regionName: region.name,
      cities: region.cities.map((city) => ({ id: city.id, name: city.name })),
    }));
}

/**
 * "Bay Area ↔ UC Irvine"-style label derived at read time from a student's
 * home region vs. their university's region, matched against
 * RouteCommunity -- never stored on User. Storing it would create a second
 * source of truth that could drift once a second route/university exists
 * (see the RouteCommunity comment in prisma/schema.prisma). Returns null for
 * anyone without both a home city and a verified StudentRecord (e.g.
 * parents, alumni, or a student whose home region has no matching route).
 *
 * Keep this personal-route condition in sync with getFeaturedRoutePairs
 * below -- the two deliberately duplicate this same check (different
 * return shapes: a label string here vs. queryable region ids there) rather
 * than sharing a helper, but they must never visibly disagree for the same
 * user (this label is shown on /profile; that one scopes Home's feed).
 */
export async function getPrimaryRouteLabel(
  user: CurrentUser,
): Promise<string | null> {
  const homeRegion = user.homeCity?.region;
  const universityRegion = user.studentRecord?.universityDomain?.region;
  if (!homeRegion || !universityRegion) return null;
  if (homeRegion.id === universityRegion.id) return null;

  const route = await prisma.routeCommunity.findFirst({
    where: {
      OR: [
        { regionAId: homeRegion.id, regionBId: universityRegion.id },
        { regionAId: universityRegion.id, regionBId: homeRegion.id },
      ],
    },
  });
  if (!route) return null;

  return `${homeRegion.name} ↔ ${universityRegion.name}`;
}

export type FeaturedRoutePair = {
  regionAId: string;
  regionBId: string;
  regionAName: string;
  regionBName: string;
};

/**
 * The region pair(s) Home scopes its feed to. Tries the user's personal
 * route first (see the sync note on getPrimaryRouteLabel above) -- if
 * found, returns exactly that one pair with isPersonal=true. Otherwise
 * falls back to every currently-`active` RouteCommunity (plural-safe: the
 * schema has no constraint limiting "at most one active," even though
 * today's seed data has exactly one), isPersonal=false. An empty `pairs`
 * array means there's nothing to scope to at all -- Home shows a generic
 * empty state rather than querying Trip/Request with no filter.
 */
export async function getFeaturedRoutePairs(
  user: CurrentUser,
): Promise<{ pairs: FeaturedRoutePair[]; isPersonal: boolean }> {
  const homeRegion = user.homeCity?.region;
  const universityRegion = user.studentRecord?.universityDomain?.region;
  if (homeRegion && universityRegion && homeRegion.id !== universityRegion.id) {
    const route = await prisma.routeCommunity.findFirst({
      where: {
        OR: [
          { regionAId: homeRegion.id, regionBId: universityRegion.id },
          { regionAId: universityRegion.id, regionBId: homeRegion.id },
        ],
      },
    });
    if (route) {
      return {
        isPersonal: true,
        pairs: [
          {
            regionAId: homeRegion.id,
            regionBId: universityRegion.id,
            regionAName: homeRegion.name,
            regionBName: universityRegion.name,
          },
        ],
      };
    }
  }

  const active = await prisma.routeCommunity.findMany({
    where: { active: true },
    include: { regionA: true, regionB: true },
  });
  return {
    isPersonal: false,
    pairs: active.map((r) => ({
      regionAId: r.regionAId,
      regionBId: r.regionBId,
      regionAName: r.regionA.name,
      regionBName: r.regionB.name,
    })),
  };
}
