"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NotificationType } from "@prisma/client";

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  connection_request: "🔗",
  connection_accepted: "✅",
  connection_declined: "✖️",
  new_message: "💬",
  trip_cancelled: "🚫",
  trip_seat_confirmed: "🪑",
  request_accepted: "🚗",
  request_trip_cancelled: "🚫",
};

export type NotificationForDisplay = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string; // pre-serialized ISO -- same reason MessageThread's Message type is
  href: string;
};

// One row on /notifications. The whole row is a Link to wherever this
// notification is about (a connection request or a conversation thread) --
// clicking it marks the notification read (same pattern MessageThread uses
// for POST .../read) and lets navigation proceed normally. The separate
// "Mark as read" button covers the case where the user wants to clear the
// unread state without leaving this page. Either path also calls
// router.refresh() once the POST resolves -- same fetch-then-refresh shape
// as MarkAllNotificationsReadButton -- so the header bell's unread count
// (computed server-side in layout.tsx) drops immediately instead of only
// on the next full page load.
export function NotificationItem({
  notification,
}: {
  notification: NotificationForDisplay;
}) {
  const router = useRouter();
  const [isRead, setIsRead] = useState(notification.isRead);

  async function markRead() {
    if (isRead) return;
    setIsRead(true);
    await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" }).catch(() => {});
    router.refresh();
  }

  return (
    <div
      className={
        isRead ? "notification-item" : "notification-item notification-item-unread"
      }
    >
      <Link href={notification.href} className="notification-item-link" onClick={markRead}>
        <span className="notification-item-icon" aria-hidden="true">
          {NOTIFICATION_ICONS[notification.type] ?? "🔔"}
        </span>
        <span className="notification-item-body">
          <span
            className={
              isRead
                ? "notification-item-title"
                : "notification-item-title notification-item-title-unread"
            }
          >
            {notification.title}
            {!isRead && <span className="unread-badge">New</span>}
          </span>
          <span className="notification-item-message">{notification.message}</span>
          <span className="notification-item-time">
            {new Date(notification.createdAt).toLocaleString()}
          </span>
        </span>
      </Link>
      {!isRead && (
        <button
          type="button"
          className="notification-mark-read-button"
          onClick={(e) => {
            e.preventDefault();
            markRead();
          }}
        >
          Mark as read
        </button>
      )}
    </div>
  );
}
