import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth";

/**
 * "Bay Area ↔ UC Irvine"-style label derived at read time from a student's
 * home region vs. their university's region, matched against
 * RouteCommunity -- never stored on User. Storing it would create a second
 * source of truth that could drift once a second route/university exists
 * (see the RouteCommunity comment in prisma/schema.prisma). Returns null for
 * anyone without both a home city and a verified StudentRecord (e.g.
 * parents, alumni, or a student whose home region has no matching route).
 *
 * Returns null more often now that Regions cover many US metro areas
 * instead of just Bay Area/UC Irvine Area -- that's this function's normal,
 * already-handled "no match" case, not a regression; RouteCommunity itself
 * (and this label) were never generalized to a many-region world, and
 * Home's own feed no longer depends on this matching (see src/app/page.tsx,
 * which now sorts by proximity to the viewer's home city instead).
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
