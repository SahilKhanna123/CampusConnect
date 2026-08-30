import { describe, it, expect } from "vitest";
import { tripFieldsSchema, requestFieldsSchema } from "./postSchemas";

const validTripBase = {
  title: "Weekend trip home",
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

  it("rejects a negative seatsTotal", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, seatsTotal: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects seatsTotal above the 20-seat cap", () => {
    const result = tripFieldsSchema.safeParse({ ...validTripBase, seatsTotal: 21 });
    expect(result.success).toBe(false);
  });

  it("accepts seatsTotal of exactly 0 (package-only trip, no riders)", () => {
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
});

const validRequestBase = {
  type: "ride" as const,
  originCityId: "city-1",
  destinationCityId: "city-2",
};

describe("requestFieldsSchema", () => {
  it("accepts a valid ride request", () => {
    expect(requestFieldsSchema.safeParse(validRequestBase).success).toBe(true);
  });

  it("accepts a valid package request", () => {
    const result = requestFieldsSchema.safeParse({
      ...validRequestBase,
      type: "package",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a type outside the ride/package enum", () => {
    const result = requestFieldsSchema.safeParse({
      ...validRequestBase,
      type: "delivery",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a request with neither destinationCityId nor destinationText", () => {
    const { destinationCityId: _drop, ...rest } = validRequestBase;
    const result = requestFieldsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a request with BOTH destinationCityId and destinationText set", () => {
    const result = requestFieldsSchema.safeParse({
      ...validRequestBase,
      destinationText: "LAX Airport",
    });
    expect(result.success).toBe(false);
  });

  it("rejects seatsRequested of 0 (minimum is 1)", () => {
    const result = requestFieldsSchema.safeParse({
      ...validRequestBase,
      seatsRequested: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects seatsRequested above the 10-seat cap", () => {
    const result = requestFieldsSchema.safeParse({
      ...validRequestBase,
      seatsRequested: 11,
    });
    expect(result.success).toBe(false);
  });

  it("accepts an explicit studentsOnly: true", () => {
    const result = requestFieldsSchema.safeParse({
      ...validRequestBase,
      studentsOnly: true,
    });
    expect(result.success).toBe(true);
  });
});
