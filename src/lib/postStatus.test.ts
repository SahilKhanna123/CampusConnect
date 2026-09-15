import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tripDisplayStatus } from "./postStatus";

const NOW = new Date("2026-08-29T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("tripDisplayStatus", () => {
  it("returns the underlying status when it isn't upcoming", () => {
    expect(
      tripDisplayStatus({ status: "completed", departureDate: new Date("2020-01-01") }),
    ).toBe("completed");
    expect(
      tripDisplayStatus({ status: "cancelled", departureDate: new Date("2099-01-01") }),
    ).toBe("cancelled");
  });

  it("returns 'upcoming' for an upcoming trip whose date hasn't passed", () => {
    expect(
      tripDisplayStatus({ status: "upcoming", departureDate: new Date("2026-09-01") }),
    ).toBe("upcoming");
  });

  it("returns 'expired' for an upcoming trip whose date has passed", () => {
    expect(
      tripDisplayStatus({ status: "upcoming", departureDate: new Date("2020-01-01") }),
    ).toBe("expired");
  });

  it("never returns 'expired' for a completed or cancelled trip, even with a past date", () => {
    expect(
      tripDisplayStatus({ status: "completed", departureDate: new Date("2020-01-01") }),
    ).not.toBe("expired");
    expect(
      tripDisplayStatus({ status: "cancelled", departureDate: new Date("2020-01-01") }),
    ).not.toBe("expired");
  });
});
