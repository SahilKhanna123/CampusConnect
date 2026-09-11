import { describe, it, expect, beforeEach } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import {
  createUser,
  createTrip,
  createCity,
  createPackagePost,
  createConversationWithParticipants,
} from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { canCreatePost, canSendMessage, canSendFamilyInvite } from "./rate-limit";

// These three functions are real anti-spam/anti-harassment controls with
// zero coverage before this file -- a live Date.now()-relative Prisma
// count() genuinely needs a real DB, mocking it would just be re-asserting
// the mock's own return value.

beforeEach(async () => {
  await resetAndSeed();
});

describe("canCreatePost", () => {
  it("is true at MAX_POSTS_PER_WINDOW - 1 existing posts, false at the cap", async () => {
    const owner = await createUser();
    const city = await createCity();

    for (let i = 0; i < 9; i++) {
      await createTrip({}, { traveler: owner, originCity: city });
    }
    expect(await canCreatePost(owner.id)).toBe(true);

    await createTrip({}, { traveler: owner, originCity: city });
    expect(await canCreatePost(owner.id)).toBe(false);
  });

  it("counts a PackagePost toward the same combined cap as Trip/Request", async () => {
    const owner = await createUser();
    const city = await createCity();

    for (let i = 0; i < 9; i++) {
      await createTrip({}, { traveler: owner, originCity: city });
    }
    expect(await canCreatePost(owner.id)).toBe(true);

    await createPackagePost({}, { postedBy: owner, originCity: city });
    expect(await canCreatePost(owner.id)).toBe(false);
  });

  it("excludes a post created outside the rolling 12-hour window", async () => {
    const owner = await createUser();
    const city = await createCity();
    const outsideWindow = new Date(Date.now() - 13 * 60 * 60 * 1000);

    // 9 old (outside-window) posts + 9 fresh ones -- if the old ones were
    // wrongly counted this would already read as at-the-cap (18 >= 10).
    for (let i = 0; i < 9; i++) {
      await createTrip(
        { createdAt: outsideWindow },
        { traveler: owner, originCity: city },
      );
    }
    for (let i = 0; i < 9; i++) {
      await createTrip({}, { traveler: owner, originCity: city });
    }
    expect(await canCreatePost(owner.id)).toBe(true);
  });
});

describe("canSendMessage", () => {
  it("is true at MAX_MESSAGES_PER_WINDOW - 1 messages, false at the cap", async () => {
    const sender = await createUser();
    const other = await createUser();
    const conversation = await createConversationWithParticipants(
      {},
      { userA: sender, userB: other },
    );

    for (let i = 0; i < 29; i++) {
      await prisma.message.create({
        data: { conversationId: conversation.id, senderId: sender.id, body: `msg ${i}` },
      });
    }
    expect(await canSendMessage(sender.id)).toBe(true);

    await prisma.message.create({
      data: { conversationId: conversation.id, senderId: sender.id, body: "cap" },
    });
    expect(await canSendMessage(sender.id)).toBe(false);
  });

  it("excludes a message sent outside the rolling 10-minute window", async () => {
    const sender = await createUser();
    const other = await createUser();
    const conversation = await createConversationWithParticipants(
      {},
      { userA: sender, userB: other },
    );
    const outsideWindow = new Date(Date.now() - 11 * 60 * 1000);

    for (let i = 0; i < 29; i++) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: sender.id,
          body: `old ${i}`,
          sentAt: outsideWindow,
        },
      });
    }
    for (let i = 0; i < 29; i++) {
      await prisma.message.create({
        data: { conversationId: conversation.id, senderId: sender.id, body: `fresh ${i}` },
      });
    }
    expect(await canSendMessage(sender.id)).toBe(true);
  });
});

describe("canSendFamilyInvite", () => {
  it("is true at MAX_FAMILY_INVITES_PER_WINDOW - 1 invites, false at the cap", async () => {
    const student = await createUser();

    for (let i = 0; i < 4; i++) {
      await prisma.parentStudentInvite.create({
        data: {
          studentId: student.id,
          parentEmail: `parent${i}@example.com`,
          token: `token-${student.id}-${i}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
    expect(await canSendFamilyInvite(student.id)).toBe(true);

    await prisma.parentStudentInvite.create({
      data: {
        studentId: student.id,
        parentEmail: "cap@example.com",
        token: `token-${student.id}-cap`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    expect(await canSendFamilyInvite(student.id)).toBe(false);
  });

  it("excludes an invite sent outside the rolling 24-hour window", async () => {
    const student = await createUser();
    const outsideWindow = new Date(Date.now() - 25 * 60 * 60 * 1000);

    for (let i = 0; i < 4; i++) {
      await prisma.parentStudentInvite.create({
        data: {
          studentId: student.id,
          parentEmail: `old${i}@example.com`,
          token: `old-token-${student.id}-${i}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdAt: outsideWindow,
        },
      });
    }
    for (let i = 0; i < 4; i++) {
      await prisma.parentStudentInvite.create({
        data: {
          studentId: student.id,
          parentEmail: `fresh${i}@example.com`,
          token: `fresh-token-${student.id}-${i}`,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    }
    expect(await canSendFamilyInvite(student.id)).toBe(true);
  });
});
