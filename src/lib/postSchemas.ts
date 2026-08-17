import { z } from "zod";

// Shared between the create (POST) and edit (PATCH) handlers for both Trip
// and Request -- can't live inside route.ts itself, since Next.js's route
// export validation rejects any named export from a route file that isn't
// a recognized HTTP method or route config key.
export const tripFieldsSchema = z.object({
  originCityId: z.string().min(1),
  destinationCityId: z.string().min(1),
  departureDate: z.string().min(1),
  departureTime: z.string().trim().max(20).optional(),
  flexibleTime: z.boolean().optional(),
  seatsTotal: z.number().int().min(0).max(20),
  packageSpaceAvailable: z.boolean().optional(),
  packageCapacityNote: z.string().trim().max(300).optional(),
  tripNotes: z.string().trim().max(1000).optional(),
});

// Standalone requests only (tripId always null) -- "request against an
// existing Trip" is a matching concept, deliberately not built yet. type
// discriminates ride vs. package fields, matching Request.type.
export const requestFieldsSchema = z.object({
  type: z.enum(["ride", "package"]),
  originCityId: z.string().min(1),
  destinationCityId: z.string().min(1),
  neededDate: z.string().trim().optional(),
  neededTime: z.string().trim().max(20).optional(),
  flexibleTime: z.boolean().optional(),
  seatsRequested: z.number().int().min(1).max(10).optional(),
  packageDescription: z.string().trim().max(500).optional(),
  packageSize: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});
