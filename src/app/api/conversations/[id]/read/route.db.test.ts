import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import { createUser, createConversationWithParticipants } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { makeUser } from "@/lib/testFixtures";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "./route";

// Representative test for the "updateMany-as-authorization" idiom shared by
// this route and its siblings (archive/unarchive, DELETE conversations/[id],
// notifications/[id]/read): a caller who isn't a participant matches zero
// rows in the updateMany, which is reported as 404 -- not a distinguishable
// 403 -- so a thread's existence isn't leaked to someone outside it.
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
  return new Request("http://localhost/api/conversations/x/read", {
    method: "POST",
  });
}

describe("POST /api/conversations/[id]/read", () => {
  it("marks lastReadAt for an actual participant", async () => {
    const participant = await createUser();
    const other = await createUser();
    const conversation = await createConversationWithParticipants(
      {},
      { userA: participant, userB: other },
    );

    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: participant.id }));

    const res = await POST(postRequest(), paramsFor(conversation.id));
    expect(res.status).toBe(200);

    const row = await prisma.conversationParticipant.findFirstOrThrow({
      where: { conversationId: conversation.id, userId: participant.id },
    });
    expect(row.lastReadAt).not.toBeNull();
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

    const res = await POST(postRequest(), paramsFor(conversation.id));
    expect(res.status).toBe(404);

    const row = await prisma.conversationParticipant.findFirst({
      where: { conversationId: conversation.id, userId: outsider.id },
    });
    expect(row).toBeNull();
  });

  it("404s for a nonexistent conversation id", async () => {
    const caller = await createUser();
    vi.mocked(getCurrentUser).mockResolvedValue(makeUser({ id: caller.id }));

    const res = await POST(postRequest(), paramsFor("nonexistent-id"));
    expect(res.status).toBe(404);
  });
});
