import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import { createUser, createConversationWithParticipants } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/lib/testFixtures";
import { getCurrentUser } from "@/lib/auth";
import { DELETE } from "./route";

// Same updateMany-as-authorization idiom as conversations/[id]/read --
// see that file's test for the fuller comment on why 404, not 403.
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

function deleteRequest() {
  return new Request("http://localhost/api/conversations/x", {
    method: "DELETE",
  });
}

describe("DELETE /api/conversations/[id]", () => {
  it("sets deletedAt for the calling participant, leaving the other participant untouched", async () => {
    const participant = await createUser();
    const other = await createUser();
    const conversation = await createConversationWithParticipants(
      {},
      { userA: participant, userB: other },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: participant.id }));

    const res = await DELETE(deleteRequest(), paramsFor(conversation.id));
    expect(res.status).toBe(200);

    const row = await prisma.conversationParticipant.findFirstOrThrow({
      where: { conversationId: conversation.id, userId: participant.id },
    });
    expect(row.deletedAt).not.toBeNull();

    const otherRow = await prisma.conversationParticipant.findFirstOrThrow({
      where: { conversationId: conversation.id, userId: other.id },
    });
    expect(otherRow.deletedAt).toBeNull();
  });

  it("404s for a caller who is not a participant, without leaking existence", async () => {
    const participant = await createUser();
    const other = await createUser();
    const outsider = await createUser();
    const conversation = await createConversationWithParticipants(
      {},
      { userA: participant, userB: other },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: outsider.id }));

    const res = await DELETE(deleteRequest(), paramsFor(conversation.id));
    expect(res.status).toBe(404);
  });

  it("404s for a nonexistent conversation id", async () => {
    const caller = await createUser();
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: caller.id }));

    const res = await DELETE(deleteRequest(), paramsFor("nonexistent-id"));
    expect(res.status).toBe(404);
  });
});
