import { describe, it, expect } from "vitest";
import { isConversationUnread } from "./messaging";

const OTHER_USER = "user-other";
const ME = "user-me";

describe("isConversationUnread", () => {
  it("is unread when there's no lastReadAt and the last message is from the other party", () => {
    const result = isConversationUnread(
      { senderId: OTHER_USER, sentAt: new Date("2026-08-29T10:00:00Z") },
      ME,
      undefined,
    );
    expect(result).toBe(true);
  });

  it("is unread when the last message postdates lastReadAt", () => {
    const result = isConversationUnread(
      { senderId: OTHER_USER, sentAt: new Date("2026-08-29T10:00:00Z") },
      ME,
      new Date("2026-08-29T09:00:00Z"),
    );
    expect(result).toBe(true);
  });

  it("is read when lastReadAt is after the last message", () => {
    const result = isConversationUnread(
      { senderId: OTHER_USER, sentAt: new Date("2026-08-29T09:00:00Z") },
      ME,
      new Date("2026-08-29T10:00:00Z"),
    );
    expect(result).toBe(false);
  });

  it("is never unread when there's no message at all", () => {
    expect(isConversationUnread(undefined, ME, null)).toBe(false);
  });

  it("is never unread when the last message is the caller's own", () => {
    const result = isConversationUnread(
      { senderId: ME, sentAt: new Date("2026-08-29T10:00:00Z") },
      ME,
      null,
    );
    expect(result).toBe(false);
  });

  it("treats an exact-equal timestamp as read, not unread", () => {
    const sentAt = new Date("2026-08-29T10:00:00Z");
    const result = isConversationUnread({ senderId: OTHER_USER, sentAt }, ME, sentAt);
    expect(result).toBe(false);
  });
});
