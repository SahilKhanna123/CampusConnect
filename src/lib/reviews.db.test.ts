import { describe, it, expect, beforeEach } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import {
  createUser,
  createTrip,
  createRequest,
  createReview,
} from "@/lib/testDbFixtures";
import { getProfileStats } from "@/lib/reviews";

beforeEach(async () => {
  await resetAndSeed();
});

describe("getProfileStats", () => {
  it("returns the empty state for a fresh user with no history", async () => {
    const user = await createUser();

    const stats = await getProfileStats(user.id);

    expect(stats).toEqual({
      averageRating: null,
      reviewCount: 0,
      completedTripCount: 0,
      completedRequestCount: 0,
    });
  });

  it("averages ratings across multiple reviews of the same reviewee, ignoring reviews they gave", async () => {
    const reviewee = await createUser();
    await createReview({ rating: 5 }, { reviewee });
    await createReview({ rating: 3 }, { reviewee });
    await createReview({ rating: 4 }, { reviewee });
    // A review this user GAVE (as reviewer, not reviewee) must not count
    // toward their own stats.
    const someoneElse = await createUser();
    await createReview({ rating: 1 }, { reviewer: reviewee, reviewee: someoneElse });

    const stats = await getProfileStats(reviewee.id);

    expect(stats.reviewCount).toBe(3);
    expect(stats.averageRating).toBeCloseTo(4, 5);
  });

  it("counts only completed trips for the traveler, not cancelled/upcoming ones", async () => {
    const traveler = await createUser();
    await createTrip({ status: "completed" }, { traveler });
    await createTrip({ status: "cancelled" }, { traveler });
    await createTrip({ status: "upcoming" }, { traveler });

    const stats = await getProfileStats(traveler.id);

    expect(stats.completedTripCount).toBe(1);
  });

  it("sums completed requests as poster and as fulfilling traveler", async () => {
    const user = await createUser();

    // As poster of a completed request.
    await createRequest(
      { status: "completed" },
      { postedBy: user, trip: await createTrip() },
    );

    // As the traveler whose trip fulfilled someone else's completed request.
    const trip = await createTrip({}, { traveler: user });
    const otherPoster = await createUser();
    await createRequest({ status: "completed" }, { postedBy: otherPoster, trip });

    const stats = await getProfileStats(user.id);

    expect(stats.completedRequestCount).toBe(2);
  });

  it("excludes non-completed requests and standalone (tripId=null) requests", async () => {
    const user = await createUser();
    await createRequest({ status: "pending" }, { postedBy: user });
    await createRequest({ status: "accepted" }, { postedBy: user, trip: await createTrip() });
    await createRequest({ status: "declined" }, { postedBy: user, trip: await createTrip() });
    await createRequest({ status: "cancelled" }, { postedBy: user, trip: await createTrip() });
    // A standalone request with no trip, even if somehow marked completed,
    // must not match the traveler-side (`trip.travelerId`) query.
    await createRequest({ status: "completed", tripId: null }, { postedBy: user });

    const stats = await getProfileStats(user.id);

    // The one tripId=null "completed" row still counts on the poster-side
    // query (postedById, independent of tripId) but must not be double
    // counted via the traveler-side relation filter.
    expect(stats.completedRequestCount).toBe(1);
  });
});
