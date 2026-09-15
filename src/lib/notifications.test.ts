import { describe, it, expect } from "vitest";
import { notificationLink, truncateForNotification } from "./notifications";

describe("notificationLink", () => {
  it("routes connection_request to the Received tab", () => {
    expect(notificationLink({ type: "connection_request", relatedId: null })).toBe(
      "/connections",
    );
  });

  it("routes connection_declined to the Sent tab", () => {
    expect(notificationLink({ type: "connection_declined", relatedId: "x" })).toBe(
      "/connections?tab=sent",
    );
  });

  it("routes connection_accepted and new_message to the conversation thread", () => {
    expect(
      notificationLink({ type: "connection_accepted", relatedId: "convo-1" }),
    ).toBe("/messages/convo-1");
    expect(notificationLink({ type: "new_message", relatedId: "convo-2" })).toBe(
      "/messages/convo-2",
    );
  });

  it("falls back to the bare /messages list when relatedId is missing", () => {
    expect(notificationLink({ type: "new_message", relatedId: null })).toBe("/messages");
  });

  it("routes trip_cancelled to the Sent tab (relatedId is a ConnectionRequest id)", () => {
    expect(notificationLink({ type: "trip_cancelled", relatedId: "cr-1" })).toBe(
      "/connections?tab=sent",
    );
  });

  it("routes trip_seat_confirmed to the trip detail page", () => {
    expect(notificationLink({ type: "trip_seat_confirmed", relatedId: "trip-1" })).toBe(
      "/trips/trip-1",
    );
  });

  it("routes parent_link_approved to /profile regardless of relatedId", () => {
    expect(notificationLink({ type: "parent_link_approved", relatedId: null })).toBe(
      "/profile",
    );
  });

  it("routes seat_offer_received and seat_offer_declined to the conversation thread", () => {
    expect(
      notificationLink({ type: "seat_offer_received", relatedId: "convo-3" }),
    ).toBe("/messages/convo-3");
    expect(
      notificationLink({ type: "seat_offer_declined", relatedId: "convo-4" }),
    ).toBe("/messages/convo-4");
  });

  it("routes seat_offer_accepted to the trip detail page", () => {
    expect(
      notificationLink({ type: "seat_offer_accepted", relatedId: "trip-2" }),
    ).toBe("/trips/trip-2");
  });

  it("routes seat_offer_trip_cancelled to the conversation thread", () => {
    expect(
      notificationLink({ type: "seat_offer_trip_cancelled", relatedId: "convo-5" }),
    ).toBe("/messages/convo-5");
  });

  it("routes family_invite_accepted to /family regardless of relatedId", () => {
    expect(
      notificationLink({ type: "family_invite_accepted", relatedId: null }),
    ).toBe("/family");
  });
});

describe("truncateForNotification", () => {
  it("returns short text unchanged", () => {
    expect(truncateForNotification("hello")).toBe("hello");
  });

  it("truncates text longer than the default 140-char limit and appends an ellipsis", () => {
    const long = "a".repeat(150);
    const result = truncateForNotification(long);
    expect(result.length).toBe(141); // 140 chars + the ellipsis character
    expect(result.endsWith("…")).toBe(true);
    expect(result.startsWith("a".repeat(140))).toBe(true);
  });

  it("does not truncate text at exactly the limit", () => {
    const exact = "a".repeat(140);
    expect(truncateForNotification(exact)).toBe(exact);
  });

  it("respects a custom maxLength", () => {
    expect(truncateForNotification("hello world", 5)).toBe("hello…");
  });
});
