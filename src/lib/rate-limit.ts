import { prisma } from "@/lib/prisma";

const WINDOW_HOURS = 12;
const MAX_POSTS_PER_WINDOW = 10;

/**
 * Anti-spam cap: at most MAX_POSTS_PER_WINDOW combined Trip + Request
 * creations per user per rolling WINDOW_HOURS window. Call this before
 * creating a Trip or Request; throw/return false to reject the write.
 */
export async function canCreatePost(userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const [tripCount, requestCount] = await Promise.all([
    prisma.trip.count({
      where: { travelerId: userId, createdAt: { gte: windowStart } },
    }),
    prisma.request.count({
      where: { postedById: userId, createdAt: { gte: windowStart } },
    }),
  ]);

  return tripCount + requestCount < MAX_POSTS_PER_WINDOW;
}
