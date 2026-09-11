import { describe, it, expect, beforeEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { resetAndSeed } from "@/lib/testDb";
import {
  createUser,
  createTrip,
  createSeatOffer,
  createConversationWithParticipants,
} from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/lib/testFixtures";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "./route";

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
  return new Request("http://localhost/api/seat-offers/x/accept", {
    method: "POST",
  });
}

describe("POST /api/seat-offers/[id]/accept -- overbooking prevention", () => {
  it("accepting decrements seatsRemaining by exactly 1", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 1, seatsRemaining: 1 },
      { traveler: owner },
    );
    const recipient = await createUser();
    const conversation = await createConversationWithParticipants(
      {},
      { trip, userA: owner, userB: recipient },
    );
    const offer = await createSeatOffer({}, { trip, recipient, conversation });

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: recipient.id }));

    const res = await POST(postRequest(), paramsFor(offer.id));
    expect(res.status).toBe(200);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(0);

    const updatedOffer = await prisma.seatOffer.findUniqueOrThrow({
      where: { id: offer.id },
    });
    expect(updatedOffer.status).toBe("accepted");
    expect(updatedOffer.seatConfirmedAt).not.toBeNull();
  });

  it("accepting decrements seatsRemaining identically for an uber_share trip -- confirms this route is category-blind", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      {
        seatsTotal: 2,
        seatsRemaining: 2,
        category: "uber_share",
        estimatedFarePerSeat: new Prisma.Decimal(8),
        meetingPoint: "Aldrich Park",
      },
      { traveler: owner },
    );
    const recipient = await createUser();
    const conversation = await createConversationWithParticipants(
      {},
      { trip, userA: owner, userB: recipient },
    );
    const offer = await createSeatOffer({}, { trip, recipient, conversation });

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: recipient.id }));

    const res = await POST(postRequest(), paramsFor(offer.id));
    expect(res.status).toBe(200);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(1);
  });

  it("with 1 seat remaining and two pending offers to different recipients, exactly one of two concurrent accepts succeeds", async () => {
    const owner = await createUser();
    const trip = await createTrip(
      { seatsTotal: 1, seatsRemaining: 1 },
      { traveler: owner },
    );
    const recipientA = await createUser();
    const recipientB = await createUser();
    const conversationA = await createConversationWithParticipants(
      {},
      { trip, userA: owner, userB: recipientA },
    );
    const conversationB = await createConversationWithParticipants(
      {},
      { trip, userA: owner, userB: recipientB },
    );
    const offerA = await createSeatOffer(
      {},
      { trip, recipient: recipientA, conversation: conversationA },
    );
    const offerB = await createSeatOffer(
      {},
      { trip, recipient: recipientB, conversation: conversationB },
    );

    const mocked = vi.mocked(getCurrentUser);
    const [resA, resB] = await Promise.all([
      (async () => {
        mocked.mockResolvedValueOnce(makeUser({ id: recipientA.id }));
        return POST(postRequest(), paramsFor(offerA.id));
      })(),
      (async () => {
        mocked.mockResolvedValueOnce(makeUser({ id: recipientB.id }));
        return POST(postRequest(), paramsFor(offerB.id));
      })(),
    ]);

    expect([resA.status, resB.status].sort()).toEqual([200, 400]);

    const updatedTrip = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(updatedTrip.seatsRemaining).toBe(0);

    const acceptedCount = await prisma.seatOffer.count({
      where: { tripId: trip.id, status: "accepted" },
    });
    expect(acceptedCount).toBe(1);
  });
});
