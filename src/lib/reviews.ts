import { prisma } from "@/lib/prisma";

/**
 * Profile-level review/completion aggregate, computed on read -- no stored
 * or denormalized column, per the plan doc's "MVP can compute any aggregate
 * on read rather than storing one." Shared by both the self profile
 * (/profile) and another user's public profile (/profile/[userId] +
 * GET /api/profile/[userId]) -- there's no private breakdown a self-viewer
 * needs that a public viewer shouldn't also see, since this data is public
 * once surfaced at all.
 */
export async function getProfileStats(userId: string) {
  // Four independent reads via Promise.all, not $transaction -- these are
  // plain SELECTs with no cross-query invariant to protect (a review or
  // completion landing mid-request just means the numbers are momentarily
  // stale, same as any other read here), so letting Postgres run them
  // concurrently is strictly better than serializing them on one
  // transaction connection.
  const [ratingAgg, completedTripCount, requestAsPosterCount, requestAsTravelerCount] =
    await Promise.all([
      prisma.review.aggregate({
        where: { revieweeId: userId },
        _avg: { rating: true },
        _count: true,
      }),
      // Query the raw DB status column, never tripDisplayStatus/
      // requestDisplayStatus (src/lib/postStatus.ts) -- those only add a
      // display-only "expired" bucket for non-terminal posts and pass
      // "completed" through unchanged, so importing them here would be the
      // wrong reflex even though it happens to be a no-op for this filter.
      prisma.trip.count({ where: { travelerId: userId, status: "completed" } }),
      // beneficiaryId always equals postedById today (on-behalf-of-student
      // posting isn't wired up yet -- see the Reviews section of
      // CLAUDE.md), matching POST /api/reviews's own
      // `isPoster = postedById === user.id` check. Filtering on postedById
      // alone is correct for now; once on-behalf-of-student posting ships,
      // this and that route's participant logic must be revisited together
      // or a beneficiary's completed requests could get double-counted.
      prisma.request.count({ where: { postedById: userId, status: "completed" } }),
      prisma.request.count({
        where: { trip: { travelerId: userId }, status: "completed" },
      }),
    ]);

  return {
    // null (never 0) when there are no reviews yet -- "0/5" would misread
    // as a bad rating rather than "not rated by anyone."
    averageRating: ratingAgg._count > 0 ? ratingAgg._avg.rating : null,
    reviewCount: ratingAgg._count,
    completedTripCount,
    completedRequestCount: requestAsPosterCount + requestAsTravelerCount,
  };
}

export type ProfileStats = Awaited<ReturnType<typeof getProfileStats>>;
