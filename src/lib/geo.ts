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
