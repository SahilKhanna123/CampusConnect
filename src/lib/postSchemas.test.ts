import { describe, it, expect } from "vitest";
import { tripFieldsSchema, packagePostFieldsSchema } from "./postSchemas";

const validTripBase = {
  title: "Weekend trip home",
  category: "personal_car" as const,
  originCityId: "city-1",
  destinationCityId: "city-2",
  departureDate: "2026-09-01",
  seatsTotal: 3,
};

describe("tripFieldsSchema", () => {
  it("accepts a valid trip with a destination City chosen", () => {
    expect(tripFieldsSchema.safeParse(validTripBase).success).toBe(true);
  });

  it("accepts a valid trip with a written-in destination instead of a City", () => {
    const { destinationCityId: _drop, ...rest } = validTripBase;
    const result = tripFieldsSchema.safeParse({
      ...rest,
      destinationText: "LAX Airport",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a trip with neither destinationCityId nor destinationText", () => {
    const { destinationCityId: _drop, ...rest } = validTripBase;
    const result = tripFieldsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a trip with BOTH destinationCityId and destinationText set", () => {
    const result = tripFieldsSchema.safeParse({
      ...validTripBase,
      destinationText: "LAX Airport",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a category outside personal_car/uber_share", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, category: "carpool" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative seatsTotal", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, seatsTotal: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects seatsTotal above the 20-seat cap", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, seatsTotal: 21 });
    expect(result.success).toBe(false);
  });

  it("accepts seatsTotal of exactly 0", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, seatsTotal: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects a non-integer seatsTotal", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, seatsTotal: 2.5 });
    expect(result.success).toBe(false);
  });

  it("studentsOnly is optional and defaults to undefined when omitted", () => {
    const result = tripFieldsSchema.safeParse(validTripBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.studentsOnly).toBeUndefined();
    }
  });

  it("accepts an explicit studentsOnly: true", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, studentsOnly: true });
    expect(result.success).toBe(true);
  });

  it("rejects an uber_share trip missing estimatedFarePerSeat and meetingPoint", () => {
    const result = tripFieldsSchema.safeParse({
      ...validTripBase,
      category: "uber_share",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an uber_share trip with estimatedFarePerSeat and meetingPoint", () => {
    const result = tripFieldsSchema.safeParse({
      ...validTripBase,
      category: "uber_share",
      estimatedFarePerSeat: 12.5,
      meetingPoint: "Front of Student Union",
    });
    expect(result.success).toBe(true);
  });

  it("does not require estimatedFarePerSeat/meetingPoint for a personal_car trip", () => {
    const result = tripFieldsSchema.safeParse(validTripBase);
    expect(result.success).toBe(true);
  });
});

const validPackagePostBase = {
  originCityId: "city-1",
  destinationCityId: "city-2",
};

describe("packagePostFieldsSchema", () => {
  it("accepts a valid package post", () => {
    expect(packagePostFieldsSchema.safeParse(validPackagePostBase).success).toBe(true);
  });

  it("rejects a post with neither destinationCityId nor destinationText", () => {
    const { destinationCityId: _drop, ...rest } = validPackagePostBase;
    const result = packagePostFieldsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a post with BOTH destinationCityId and destinationText set", () => {
    const result = packagePostFieldsSchema.safeParse({
      ...validPackagePostBase,
      destinationText: "LAX Airport",
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes over the 300-character cap", () => {
    const result = packagePostFieldsSchema.safeParse({
      ...validPackagePostBase,
      notes: "x".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("has no packageDescription/packageSize fields -- minimal by design", () => {
    const result = packagePostFieldsSchema.safeParse({
      ...validPackagePostBase,
      packageDescription: "a box of textbooks",
    });
    // Zod's default (non-strict) object parsing strips unknown keys rather
    // than rejecting them -- this test documents that an old-shaped field
    // is silently dropped, not that submitting it is an error.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("packageDescription");
    }
  });
});
