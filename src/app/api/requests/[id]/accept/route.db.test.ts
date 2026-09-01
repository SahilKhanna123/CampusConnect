import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import { createUser, createTrip, createRequest } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/lib/testFixtures";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "./route";

// requests/accept also imports hasStudentRecord from @/lib/auth -- preserving
// importOriginal's real exports (rather than mocking the whole module) keeps
// that working while only getCurrentUser is faked.
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

function postRequest(tripId: string) {
  return new Request("http://localhost/api/requests/x/accept", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tripId }),
  });
}

describe("POST /api/requests/[id]/accept -- overbooking prevention", () => {
  it("a single accept decrements seatsRemaining by seatsRequested (defaulting to 1)", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 2, seatsRemaining: 2 },
      { traveler: owner },
    );
    const poster = await createUser();
    const req = await createRequest({}, { postedBy: poster });

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const res = await POST(postRequest(trip.id), paramsFor(req.id));
    expect(res.status).toBe(200);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(1);

    const updatedRequest = await prisma.request.findUniqueOrThrow({
      where: { id: req.id },
    });
    expect(updatedRequest.status).toBe("accepted");
    expect(updatedRequest.tripId).toBe(trip.id);
  });

  it("with 1 seat remaining and two pending 1-seat requests, exactly one of two concurrent accepts succeeds", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 1, seatsRemaining: 1 },
      { traveler: owner },
    );
    const posterA = await createUser();
    const posterB = await createUser();
    const reqA = await createRequest({}, { postedBy: posterA });
    const reqB = await createRequest({}, { postedBy: posterB });

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const [resA, resB] = await Promise.all([
      POST(postRequest(trip.id), paramsFor(reqA.id)),
      POST(postRequest(trip.id), paramsFor(reqB.id)),
    ]);

    expect([resA.status, resB.status].sort()).toEqual([200, 400]);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(0);

    const acceptedCount = await prisma.request.count({
      where: { tripId: trip.id, status: "accepted" },
    });
    expect(acceptedCount).toBe(1);
  });

  it("rejects a 2-seat request against a trip with only 1 seat remaining, with no partial decrement", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 1, seatsRemaining: 1 },
      { traveler: owner },
    );
    const poster = await createUser();
    const req = await createRequest({ seatsRequested: 2 }, { postedBy: poster });

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const res = await POST(postRequest(trip.id), paramsFor(req.id));
    expect(res.status).toBe(400);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    // Capacity check + write share one transaction -- a rejected accept must
    // leave seatsRemaining completely untouched, not partially decremented.
    expect(updatedTrip.seatsRemaining).toBe(1);

    const updatedRequest = await prisma.request.findUniqueOrThrow({
      where: { id: req.id },
    });
    expect(updatedRequest.status).toBe("pending");
    expect(updatedRequest.tripId).toBeNull();
  });

  it("accepts a package request purely on packageSpaceAvailable, with no seat decrement", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      {
        seatsTotal: 1,
        seatsRemaining: 1,
        packageSpaceAvailable: true,
      },
      { traveler: owner },
    );
    const poster = await createUser();
    const req = await createRequest(
      { type: "package", seatsRequested: null },
      { postedBy: poster },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const res = await POST(postRequest(trip.id), paramsFor(req.id));
    expect(res.status).toBe(200);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(1);
  });
});
