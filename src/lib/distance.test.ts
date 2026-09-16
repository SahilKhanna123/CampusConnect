import { describe, it, expect } from "vitest";
import { haversineDistanceMiles } from "./distance";

describe("haversineDistanceMiles", () => {
  it("returns 0 for identical coordinates", () => {
    expect(
      haversineDistanceMiles({ lat: 37.7749, lng: -122.4194 }, { lat: 37.7749, lng: -122.4194 }),
    ).toBe(0);
  });

  it("returns a known real-world distance within a tolerance band", () => {
    // San Francisco <-> Irvine, CA -- straight-line distance, computed via
    // this same formula, is ~382 miles; asserting a band around that
    // rather than pinning the exact float.
    const sf = { lat: 37.7749, lng: -122.4194 };
    const irvine = { lat: 33.6846, lng: -117.8265 };
    const distance = haversineDistanceMiles(sf, irvine);
    expect(distance).toBeGreaterThan(370);
    expect(distance).toBeLessThan(395);
  });

  it("is symmetric", () => {
    const a = { lat: 40.7128, lng: -74.006 };
    const b = { lat: 34.0522, lng: -118.2437 };
    expect(haversineDistanceMiles(a, b)).toBeCloseTo(haversineDistanceMiles(b, a), 10);
  });
});
