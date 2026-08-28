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
    // relatedId is the trip's own id here (not the ConnectionRequest's, the
    // only NotificationType where that's true) -- confirm-seat's whole point
    // is the trip itself, and the rider's own status on it is already
    // visible right there on /trips/[id] (see the trip detail page).
    case "trip_seat_confirmed":
      return `/trips/${notification.relatedId}`;
    // Both carry the Request's own id as relatedId -- deliberately NOT the
    // same case as trip_cancelled above, since that one's relatedId is
    // always a ConnectionRequest.id and this function has no way to tell
    // the two apart if they shared a case.
    case "request_accepted":
    case "request_trip_cancelled":
      return `/requests/${notification.relatedId}`;
    // Same destination as the two cases above (relatedId is the Request's
    // own id) -- kept as its own NotificationType anyway since it's a
    // semantically different event, not a reuse for reuse's sake.
    case "review_received":
      return `/requests/${notification.relatedId}`;
    // relatedId is the Conversation's own id -- the recipient responds
    // (accept/decline) right there in the same thread the offer came from.
    case "seat_offer_received":
      return `/messages/${notification.relatedId}`;
    // relatedId is the Trip's own id here -- the owner's Participants list
    // is the natural place to see the result of an accept.
    case "seat_offer_accepted":
      return `/trips/${notification.relatedId}`;
    // relatedId is the Conversation's own id, so the owner can follow up.
    case "seat_offer_declined":
      return `/messages/${notification.relatedId}`;
    // Same destination as seat_offer_received/declined above (relatedId is
    // the Conversation's own id) -- kept distinct rather than reusing
    // trip_cancelled for the same disambiguation reason as
    // request_trip_cancelled: that type's relatedId is always a
    // ConnectionRequest.id, hardcoded to /connections, wrong here.
    case "seat_offer_trip_cancelled":
      return `/messages/${notification.relatedId}`;
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
