import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import { createUser, createNotification } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/lib/testFixtures";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "./route";

// Same updateMany-as-authorization idiom as conversations/[id]/read -- a
// caller who doesn't own the notification matches zero rows in the
// updateMany, reported as 404 (not a distinguishable 403), so a
// notification's existence isn't leaked to someone it doesn't belong to.
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
  return new Request("http://localhost/api/notifications/x/read", {
    method: "POST",
  });
}

describe("POST /api/notifications/[id]/read", () => {
  it("marks isRead for the notification's own owner", async () => {
    const owner = await createUser();
    const notification = await createNotification({}, { user: owner });

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: owner.id }));

    const res = await POST(postRequest(), paramsFor(notification.id));
    expect(res.status).toBe(200);

    const row = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(row.isRead).toBe(true);
  });

  it("404s for a caller who doesn't own the notification, without leaking existence", async () => {
    const owner = await createUser();
    const outsider = await createUser();
    const notification = await createNotification({}, { user: owner });

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: outsider.id }));

    const res = await POST(postRequest(), paramsFor(notification.id));
    expect(res.status).toBe(404);

    const row = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(row.isRead).toBe(false);
  });

  it("404s for a nonexistent notification id", async () => {
    const caller = await createUser();
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: caller.id }));

    const res = await POST(postRequest(), paramsFor("nonexistent-id"));
    expect(res.status).toBe(404);
  });
});
