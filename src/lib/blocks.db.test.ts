import { describe, it, expect, beforeEach } from "vitest";
import { resetAndSeed } from "@/lib/testDb";
import { createUser } from "@/lib/testDbFixtures";
import { prisma } from "@/lib/prisma";
import { isBlockedBetween, getBlockedCounterpartIds } from "./blocks";

beforeEach(async () => {
  await resetAndSeed();
});

describe("isBlockedBetween", () => {
  it("is true when A blocked B", async () => {
    const a = await createUser();
    const b = await createUser();
    await prisma.block.create({ data: { blockerId: a.id, blockedId: b.id } });

    expect(await isBlockedBetween(a.id, b.id)).toBe(true);
  });

  it("is true in the reverse direction too -- B blocked A still blocks A<->B", async () => {
    const a = await createUser();
    const b = await createUser();
    await prisma.block.create({ data: { blockerId: b.id, blockedId: a.id } });

    expect(await isBlockedBetween(a.id, b.id)).toBe(true);
  });

  it("is false when neither has blocked the other", async () => {
    const a = await createUser();
    const b = await createUser();

    expect(await isBlockedBetween(a.id, b.id)).toBe(false);
  });

  it("is false for an unrelated block between two other users", async () => {
    const a = await createUser();
    const b = await createUser();
    const c = await createUser();
    await prisma.block.create({ data: { blockerId: a.id, blockedId: c.id } });

    expect(await isBlockedBetween(a.id, b.id)).toBe(false);
  });
});

describe("getBlockedCounterpartIds", () => {
  it("includes both users the caller blocked and users who blocked the caller", async () => {
    const me = await createUser();
    const iBlocked = await createUser();
    const blockedMe = await createUser();
    const unrelated = await createUser();
    await prisma.block.create({ data: { blockerId: me.id, blockedId: iBlocked.id } });
    await prisma.block.create({ data: { blockerId: blockedMe.id, blockedId: me.id } });

    const ids = await getBlockedCounterpartIds(me.id);

    expect(ids.sort()).toEqual([iBlocked.id, blockedMe.id].sort());
    expect(ids).not.toContain(unrelated.id);
  });

  it("returns an empty array when there are no blocks involving the caller", async () => {
    const me = await createUser();
    expect(await getBlockedCounterpartIds(me.id)).toEqual([]);
  });
});
