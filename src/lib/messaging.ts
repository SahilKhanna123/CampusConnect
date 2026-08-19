import { prisma } from "@/lib/prisma";

/**
 * Shared "is this conversation unread for this user" rule: the most recent
 * Message was sent by someone else, and either the user has never opened
 * this conversation (lastReadAt null) or that message arrived after they
 * last opened it. Deliberately only checks the LAST message, not every
 * message since lastReadAt -- the only way to send a reply is by opening
 * the thread page first (which marks it read via POST
 * /api/conversations/[id]/read), so there's no realistic way for an
 * earlier unread message to exist while a later one from the same
 * counterpart doesn't also satisfy this check.
 */
export function isConversationUnread(
  lastMessage: { senderId: string; sentAt: Date } | undefined,
  currentUserId: string,
  lastReadAt: Date | null | undefined,
): boolean {
  if (!lastMessage || lastMessage.senderId === currentUserId) return false;
  return !lastReadAt || lastMessage.sentAt > lastReadAt;
}

/**
 * Count of the caller's conversations with an unread message -- powers the
 * badge next to "Messages" in src/app/layout.tsx's nav. Recomputed on every
 * page load, no caching -- same tradeoff the rest of this app already makes
 * for per-request derived state (see getPrimaryRouteLabel in geo.ts).
 */
export async function getUnreadConversationCount(userId: string): Promise<number> {
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: { senderId: true, sentAt: true },
          },
        },
      },
    },
  });

  return participants.filter((p) =>
    isConversationUnread(p.conversation.messages[0], userId, p.lastReadAt),
  ).length;
}
