import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { resetAndSeed } from "@/lib/testDb";
import { createUser, createTrip, createConnectionRequest } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/lib/testFixtures";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "./route";

// getCurrentUser is the only thing this route touches that would otherwise
// require a real Supabase session (cookies()/@supabase/ssr) -- mocking it
// alone is sufficient since the route never calls next/headers directly.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return { ...actual, getCurrentUser: vi.fn() };
});

beforeEach(async () => {
  await resetAndSeed();
});

function paramsFor(id: string) {
  return { params: Promise.resolve({ id }) };
}

function postRequest() {
  return new Request("http://localhost/api/connection-requests/x/confirm-seat", {
    method: "POST",
  });
}

describe("POST /api/connection-requests/[id]/confirm-seat -- overbooking prevention", () => {
  it("decrements seatsRemaining by exactly 1 on a single confirm", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 2, seatsRemaining: 2 },
      { traveler: owner },
    );
    const rider = await createUser();
    const cr = await createConnectionRequest(
      {},
      { trip, requester: rider, recipient: owner },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const res = await POST(postRequest(), paramsFor(cr.id));
    expect(res.status).toBe(200);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(1);

    const updatedCr = await prisma.connectionRequest.findUniqueOrThrow({
      where: { id: cr.id },
    });
    expect(updatedCr.seatConfirmedAt).not.toBeNull();
  });

  it("with 1 seat remaining and two accepted connection requests, exactly one of two concurrent confirms succeeds", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 1, seatsRemaining: 1 },
      { traveler: owner },
    );
    const riderA = await createUser();
    const riderB = await createUser();
    const crA = await createConnectionRequest(
      {},
      { trip, requester: riderA, recipient: owner },
    );
    const crB = await createConnectionRequest(
      {},
      { trip, requester: riderB, recipient: owner },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const [resA, resB] = await Promise.all([
      POST(postRequest(), paramsFor(crA.id)),
      POST(postRequest(), paramsFor(crB.id)),
    ]);

    // Exactly one wins (200), exactly one loses (400 "No seats remaining") --
    // never both succeeding (which would overbook) and never both failing.
    expect([resA.status, resB.status].sort()).toEqual([200, 400]);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    // Never negative, never double-decremented.
    expect(updatedTrip.seatsRemaining).toBe(0);

    const confirmedCount = await prisma.connectionRequest.count({
      where: { tripId: trip.id, seatConfirmedAt: { not: null } },
    });
    expect(confirmedCount).toBe(1);
  });

  it("decrements seatsRemaining identically for an uber_share trip -- confirms this route is category-blind", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      {
        seatsTotal: 2,
        seatsRemaining: 2,
        category: "uber_share",
        estimatedFarePerSeat: new Prisma.Decimal(9.75),
        meetingPoint: "Ring Road Loop",
      },
      { traveler: owner },
    );
    const rider = await createUser();
    const cr = await createConnectionRequest(
      {},
      { trip, requester: rider, recipient: owner },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const res = await POST(postRequest(), paramsFor(cr.id));
    expect(res.status).toBe(200);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(1);
  });

  it("rejects confirming when the trip already has 0 seats remaining", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 1, seatsRemaining: 0 },
      { traveler: owner },
    );
    const rider = await createUser();
    const cr = await createConnectionRequest(
      {},
      { trip, requester: rider, recipient: owner },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const res = await POST(postRequest(), paramsFor(cr.id));
    expect(res.status).toBe(400);

    const updatedCr = await prisma.connectionRequest.findUniqueOrThrow({
      where: { id: cr.id },
    });
    expect(updatedCr.seatConfirmedAt).toBeNull();
  });
});
