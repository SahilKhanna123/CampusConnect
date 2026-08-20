import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

/**
 * The one notification-creation path in the app -- every trigger site
 * (connection request create/accept/decline, new message) calls this rather
 * than a bespoke prisma.notification.create, same convention as
 * findOrCreateConversationForTrip being the one Conversation-creation path.
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  relatedId,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string | null;
}) {
  return prisma.notification.create({
    data: { userId, type, title, message, relatedId: relatedId ?? null },
  });
}

/**
 * Where clicking a notification should navigate -- the one place that maps
 * NotificationType -> destination URL, so /notifications doesn't have to
 * duplicate this switch. connection_request/declined don't carry enough
 * context to deep-link to a single row (a request can be re-sent after a
 * decline, so there's no permanently stable target) -- they land on the
 * relevant /connections tab instead, same granularity the feature's own UI
 * already uses for those states.
 */
export function notificationLink(notification: {
  type: NotificationType;
  relatedId: string | null;
}): string {
  switch (notification.type) {
    case "connection_request":
      return "/connections";
    case "connection_declined":
      return "/connections?tab=sent";
    case "connection_accepted":
    case "new_message":
      return notification.relatedId
        ? `/messages/${notification.relatedId}`
        : "/messages";
    // relatedId is the ConnectionRequest's own id (not the trip's) for both
    // the pending-invalidated and still-accepted cases -- the Sent tab
    // already shows the request's current status either way, and an
    // accepted row's trip link still leads to the "Connected — View
    // messages" call-to-action on /trips/[id], so one destination covers
    // both without needing to tell them apart here.
    case "trip_cancelled":
      return "/connections?tab=sent";
    default:
      return "/notifications";
  }
}

/** Powers the badge next to "Notifications" in src/app/layout.tsx's nav. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

/** Truncates a message body for use inside a notification's own message text. */
export function truncateForNotification(body: string, maxLength = 140): string {
  return body.length > maxLength ? `${body.slice(0, maxLength)}…` : body;
}
