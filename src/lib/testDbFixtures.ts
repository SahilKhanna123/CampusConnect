import { randomUUID } from "crypto";
import type {
  User,
  Region,
  City,
  SupportedUniversityDomain,
  StudentRecord,
  Trip,
  Request,
  ConnectionRequest,
  SeatOffer,
  Conversation,
  Review,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/lib/testFixtures";

// DB-backed fixture factories -- requires a live Postgres connection. Only
// ever import this from a *.db.test.ts file. Separate from testFixtures.ts,
// which must stay Prisma-free so the existing pure *.test.ts suite keeps
// zero DB dependency -- these factories perform real prisma.<model>.create
// inserts, testFixtures.ts's factories return plain objects.
//
// Each factory auto-creates required parent rows when not passed via its
// `deps` argument, so a test only has to spell out the relationships it
// actually cares about. Every unique-constrained field gets a random
// suffix, as defense-in-depth beyond the per-test resetTestDb() truncate
// (see src/lib/testDb.ts).

function suffix(): string {
  return randomUUID().slice(0, 8);
}

export async function createRegion(
  overrides: Partial<Region> = {},
): Promise<Region> {
  const s = suffix();
  return prisma.region.create({
    data: {
      name: `Region ${s}`,
      slug: `region-${s}`,
      ...overrides,
    },
  });
}

export async function createCity(
  overrides: Partial<City> = {},
  deps: { region?: Region } = {},
): Promise<City> {
  const region = deps.region ?? (await createRegion());
  const s = suffix();
  return prisma.city.create({
    data: {
      name: `City ${s}`,
      regionId: region.id,
      ...overrides,
    },
  });
}

export async function createUniversityDomain(
  overrides: Partial<SupportedUniversityDomain> = {},
  deps: { region?: Region } = {},
): Promise<SupportedUniversityDomain> {
  const region = deps.region ?? (await createRegion());
  const s = suffix();
  return prisma.supportedUniversityDomain.create({
    data: {
      domain: `test-${s}.edu`,
      universityName: `Test University ${s}`,
      regionId: region.id,
      ...overrides,
    },
  });
}

// Reuses testFixtures.ts's makeUser() for default scalar field values
// (name, collegeName, etc.), stripping the relation-only fields it also
// returns (verifications/parentLinksAsParent/homeCity/studentRecord) since
// those aren't columns on User itself -- keeps the two fixture files'
// defaults consistent without duplicating literals. User.id has no DB
// default (it always mirrors a Supabase auth.users.id in real usage), so a
// random one is generated here unless overridden.
export async function createUser(overrides: Partial<User> = {}): Promise<User> {
  const s = suffix();
  const base = makeUser({
    id: overrides.id ?? `user-${s}`,
    email: overrides.email ?? `user-${s}@example.com`,
  });
  const { verifications, parentLinksAsParent, homeCity, studentRecord, ...userFields } =
    base;
  return prisma.user.create({
    data: { ...userFields, ...overrides },
  });
}

export async function createStudentRecord(
  overrides: Partial<StudentRecord> = {},
  deps: { user?: User; domain?: SupportedUniversityDomain } = {},
): Promise<StudentRecord> {
  const domain = deps.domain ?? (await createUniversityDomain());
  const s = suffix();
  return prisma.studentRecord.create({
    data: {
      fullName: "Test Student",
      universityEmail: `student-${s}@${domain.domain}`,
      universityDomainId: domain.id,
      userId: deps.user?.id ?? null,
      ...overrides,
    },
  });
}

export async function createTrip(
  overrides: Partial<Trip> = {},
  deps: { traveler?: User; originCity?: City } = {},
): Promise<Trip> {
  const traveler = deps.traveler ?? (await createUser());
  const originCity = deps.originCity ?? (await createCity());
  return prisma.trip.create({
    data: {
      travelerId: traveler.id,
      title: "Test Trip",
      originCityId: originCity.id,
      destinationText: "Test Destination",
      departureDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      seatsTotal: 1,
      seatsRemaining: 1,
      status: "upcoming",
      ...overrides,
    },
  });
}

export async function createRequest(
  overrides: Partial<Request> = {},
  deps: { postedBy?: User; beneficiary?: User; trip?: Trip } = {},
): Promise<Request> {
  const postedBy = deps.postedBy ?? (await createUser());
  const beneficiary = deps.beneficiary ?? postedBy;
  return prisma.request.create({
    data: {
      type: "ride",
      postedById: postedBy.id,
      beneficiaryId: beneficiary.id,
      tripId: deps.trip?.id ?? null,
      destinationText: "Test Destination",
      status: "pending",
      ...overrides,
    },
  });
}

// recipient/requester both default to a fresh, unrelated user. For an
// ownership-sensitive test (e.g. confirm-seat, which requires
// recipientId === the trip's own travelerId), pass deps.recipient as the
// same User object used for deps.traveler when creating the trip -- this
// factory deliberately does NOT try to infer that relationship itself
// (attempting to auto-create a user reusing trip.travelerId as its id would
// collide with the user createTrip() already created).
export async function createConnectionRequest(
  overrides: Partial<ConnectionRequest> = {},
  deps: { trip?: Trip; requester?: User; recipient?: User } = {},
): Promise<ConnectionRequest> {
  const trip = deps.trip ?? (await createTrip());
  const requester = deps.requester ?? (await createUser());
  const recipient = deps.recipient ?? (await createUser());
  return prisma.connectionRequest.create({
    data: {
      tripId: trip.id,
      requesterId: requester.id,
      recipientId: recipient.id,
      status: "accepted",
      ...overrides,
    },
  });
}

export async function createConversationWithParticipants(
  overrides: Partial<Conversation> = {},
  deps: { trip?: Trip; userA?: User; userB?: User } = {},
): Promise<Conversation & { participantIds: [string, string] }> {
  const trip = deps.trip ?? (await createTrip());
  const userA = deps.userA ?? (await createUser());
  const userB = deps.userB ?? (await createUser());
  const conversation = await prisma.conversation.create({
    data: {
      tripId: trip.id,
      ...overrides,
      participants: {
        create: [{ userId: userA.id }, { userId: userB.id }],
      },
    },
  });
  return { ...conversation, participantIds: [userA.id, userB.id] };
}

// recipient defaults to a fresh, unrelated user -- same caveat as
// createConnectionRequest's recipient above (pass deps.recipient
// explicitly for an ownership-sensitive test).
export async function createSeatOffer(
  overrides: Partial<SeatOffer> = {},
  deps: { trip?: Trip; recipient?: User; conversation?: Conversation } = {},
): Promise<SeatOffer> {
  const trip = deps.trip ?? (await createTrip());
  const recipient = deps.recipient ?? (await createUser());
  const conversation =
    deps.conversation ??
    (await prisma.conversation.create({ data: { tripId: trip.id } }));
  return prisma.seatOffer.create({
    data: {
      tripId: trip.id,
      recipientId: recipient.id,
      conversationId: conversation.id,
      status: "pending",
      ...overrides,
    },
  });
}

// request defaults to a fresh completed Request+Trip pair; reviewer/reviewee
// both default to a fresh, unrelated user -- same caveat as
// createConnectionRequest's recipient above: this factory does NOT try to
// infer reviewer/reviewee from the request's actual postedById/
// trip.travelerId, so a test exercising revieweeId-keyed logic (e.g.
// getProfileStats) must pass deps.reviewee explicitly as the real target
// User object.
export async function createReview(
  overrides: Partial<Review> = {},
  deps: { request?: Request; reviewer?: User; reviewee?: User } = {},
): Promise<Review> {
  const request =
    deps.request ??
    (await createRequest({ status: "completed" }, { trip: await createTrip() }));
  const reviewer = deps.reviewer ?? (await createUser());
  const reviewee = deps.reviewee ?? (await createUser());
  return prisma.review.create({
    data: {
      requestId: request.id,
      reviewerId: reviewer.id,
      revieweeId: reviewee.id,
      rating: 5,
      ...overrides,
    },
  });
}
