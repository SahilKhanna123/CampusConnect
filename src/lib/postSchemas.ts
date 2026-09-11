import { z } from "zod";

// Shared between the create (POST) and edit (PATCH) handlers for Trip,
// Request, and PackagePost -- can't live inside route.ts itself, since
// Next.js's route export validation rejects any named export from a route
// file that isn't a recognized HTTP method or route config key.
// destinationCityId/destinationText: a poster picks a listed City OR types
// a destination that isn't in the seeded list (e.g. an airport) -- exactly
// one of the two must be present, checked below since Zod object() alone
// can't express "one of these two fields".
const tripCategorySchema = z.enum(["personal_car", "uber_share"]);

// category discriminates today's original "I'm driving my own car" feature
// (personal_car) from splitting a real Uber/Lyft ride (uber_share) -- see
// the TripCategory enum comment in prisma/schema.prisma for the full
// rationale. estimatedFarePerSeat/meetingPoint are only meaningful (and
// required) for uber_share, enforced below via superRefine -- the first
// type-conditional validation in this file, following the same idea as the
// destination XOR refine just below it, keyed on a discriminator instead
// of two mutually-exclusive fields.
export const tripFieldsSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    category: tripCategorySchema,
    originCityId: z.string().min(1),
    destinationCityId: z.string().min(1).optional(),
    destinationText: z.string().trim().min(1).max(100).optional(),
    departureDate: z.string().min(1),
    departureTime: z.string().trim().max(20).optional(),
    flexibleTime: z.boolean().optional(),
    seatsTotal: z.number().int().min(0).max(20),
    // uber_share only -- a stated, informational per-seat cost, never a
    // real payment (see the schema comment on Trip.estimatedFarePerSeat).
    estimatedFarePerSeat: z.number().positive().max(9999.99).optional(),
    // uber_share only -- the one pickup spot everyone in the group needs
    // to converge on (see the schema comment on Trip.meetingPoint).
    meetingPoint: z.string().trim().max(200).optional(),
    tripNotes: z.string().trim().max(1000).optional(),
    // Only actually settable to true by a poster with a claimed
    // StudentRecord -- enforced in the route handler (Zod alone can't see
    // the caller), see the schema comment on Request.studentsOnly.
    studentsOnly: z.boolean().optional(),
  })
  .refine((data) => !!data.destinationCityId !== !!data.destinationText, {
    message: "Choose a destination city or type one in, not both.",
    path: ["destinationCityId"],
  })
  .superRefine((data, ctx) => {
    if (data.category !== "uber_share") return;
    if (!data.estimatedFarePerSeat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter an estimated fare per seat for a shared Uber/Lyft.",
        path: ["estimatedFarePerSeat"],
      });
    }
    if (!data.meetingPoint) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a meeting point for a shared Uber/Lyft.",
        path: ["meetingPoint"],
      });
    }
  });

// Standalone requests only (tripId always null) -- "request against an
// existing Trip" is a matching concept, deliberately not built yet.
// category mirrors Trip.category, matched later against whichever Trip
// fulfills this request (see POST /api/requests/[id]/accept).
export const requestFieldsSchema = z
  .object({
    category: tripCategorySchema,
    originCityId: z.string().min(1),
    // See tripFieldsSchema's comment -- exactly one of destinationCityId /
    // destinationText must be present.
    destinationCityId: z.string().min(1).optional(),
    destinationText: z.string().trim().min(1).max(100).optional(),
    neededDate: z.string().trim().optional(),
    neededTime: z.string().trim().max(20).optional(),
    flexibleTime: z.boolean().optional(),
    seatsRequested: z.number().int().min(1).max(10).optional(),
    // uber_share only, and optional even then -- a rider asking may not
    // have a number in mind yet (see the schema comment on
    // Request.estimatedFarePerSeat).
    estimatedFarePerSeat: z.number().positive().max(9999.99).optional(),
    notes: z.string().trim().max(1000).optional(),
    // Only actually settable to true by a poster with a claimed
    // StudentRecord -- enforced in the route handler, see the schema
    // comment on Request.studentsOnly.
    studentsOnly: z.boolean().optional(),
  })
  .refine((data) => !!data.destinationCityId !== !!data.destinationText, {
    message: "Choose a destination city or type one in, not both.",
    path: ["destinationCityId"],
  });

// Package carrying -- deliberately minimal per product decision: no
// structured description/size, no fare, no seat/capacity concept. kind
// covers both "I have space" and "I need something delivered"; any real
// coordination happens over DM (see PackageMessageForm.tsx), not a form
// field.
export const packagePostFieldsSchema = z
  .object({
    kind: z.enum(["offering_space", "needing_delivery"]),
    originCityId: z.string().min(1),
    destinationCityId: z.string().min(1).optional(),
    destinationText: z.string().trim().min(1).max(100).optional(),
    date: z.string().trim().optional(),
    time: z.string().trim().max(20).optional(),
    flexibleTime: z.boolean().optional(),
    notes: z.string().trim().max(300).optional(),
    studentsOnly: z.boolean().optional(),
  })
  .refine((data) => !!data.destinationCityId !== !!data.destinationText, {
    message: "Choose a destination city or type one in, not both.",
    path: ["destinationCityId"],
  });
