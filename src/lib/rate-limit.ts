import { prisma } from "@/lib/prisma";

const WINDOW_HOURS = 12;
const MAX_POSTS_PER_WINDOW = 10;

/**
 * Anti-spam cap: at most MAX_POSTS_PER_WINDOW combined Trip + PackagePost
 * creations per user per rolling WINDOW_HOURS window -- one shared budget
 * across both post categories (Trips, Uber-sharing is just a Trip category,
 * and Package carrying), not a separate cap per category. Call this before
 * creating either, throw/return false to reject the write.
 */
export async function canCreatePost(userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

  const [tripCount, packagePostCount] = await Promise.all([
    prisma.trip.count({
      where: { travelerId: userId, createdAt: { gte: windowStart } },
    }),
    prisma.packagePost.count({
      where: { postedById: userId, createdAt: { gte: windowStart } },
    }),
  ]);

  return tripCount + packagePostCount < MAX_POSTS_PER_WINDOW;
}

const MESSAGE_WINDOW_MINUTES = 10;
const MAX_MESSAGES_PER_WINDOW = 30;

/**
 * Anti-spam/anti-harassment cap: at most MAX_MESSAGES_PER_WINDOW messages
 * sent by one user per rolling MESSAGE_WINDOW_MINUTES window, across all
 * their conversations combined. Without this, a scripted loop could flood
 * a specific victim's thread with unlimited messages -- see POST
 * /api/conversations and POST /api/conversations/[id]/messages, the two
 * places a Message gets created.
 */
export async function canSendMessage(userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - MESSAGE_WINDOW_MINUTES * 60 * 1000);
  const count = await prisma.message.count({
    where: { senderId: userId, sentAt: { gte: windowStart } },
  });
  return count < MAX_MESSAGES_PER_WINDOW;
}

const FAMILY_INVITE_WINDOW_HOURS = 24;
const MAX_FAMILY_INVITES_PER_WINDOW = 5;

/**
 * Anti-spam cap: at most MAX_FAMILY_INVITES_PER_WINDOW parent/guardian
 * invite emails sent by one student per rolling FAMILY_INVITE_WINDOW_HOURS
 * window -- see POST /api/family/invite. Each invite is a real email sent
 * via Resend to an address of the caller's choosing, so unlike most other
 * writes in this app, unbounded spam here has a real send-cost and
 * arbitrary-third-party-abuse angle, not just DB bloat.
 */
export async function canSendFamilyInvite(userId: string): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - FAMILY_INVITE_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const count = await prisma.parentStudentInvite.count({
    where: { studentId: userId, createdAt: { gte: windowStart } },
  });
  return count < MAX_FAMILY_INVITES_PER_WINDOW;
}
