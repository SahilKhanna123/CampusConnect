import { prisma } from "@/lib/prisma";

/**
 * True if either user has blocked the other. `Block` is stored as a
 * one-directional row (blockerId -> blockedId) but is enforced
 * bidirectionally everywhere it matters -- neither party can start a new
 * conversation or connection request with the other, regardless of who did
 * the blocking (plan doc §7, Decisions Log #13).
 */
export async function isBlockedBetween(
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userIdA, blockedId: userIdB },
        { blockerId: userIdB, blockedId: userIdA },
      ],
    },
    select: { id: true },
  });
  return !!block;
}

/**
 * Every user id bidirectionally blocked with `userId` -- either userId
 * blocked them, or they blocked userId. Used to filter Explore so a blocked
 * pair disappears from each other's feed regardless of who initiated the
 * block (plan doc §7: "a blocked user disappears from the blocker's
 * search/Explore results and vice versa").
 */
export async function getBlockedCounterpartIds(userId: string): Promise<string[]> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }
  return [...ids];
}
