import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationLink } from "@/lib/notifications";
import { NotificationItem } from "@/components/NotificationItem";
import { MarkAllNotificationsReadButton } from "@/components/MarkAllNotificationsReadButton";

// Notifications -- the caller's own rows, most recent first, same
// server-component-queries-Prisma-directly convention as /messages and
// /connections (no client-side fetch against a GET /api/notifications).
// take: 100 is a simple cap, not real pagination -- consistent with how
// nothing else in this app paginates yet.
export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Notifications</span>
          <h1 className="heading-tight">Notifications</h1>
        </div>
        {hasUnread && <MarkAllNotificationsReadButton />}
      </div>

      {notifications.length === 0 ? (
        <p>
          You don&apos;t have any notifications yet. Connection requests and
          new messages will show up here.
        </p>
      ) : (
        <div className="notification-list">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={{
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                isRead: n.isRead,
                createdAt: n.createdAt.toISOString(),
                href: notificationLink(n),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
