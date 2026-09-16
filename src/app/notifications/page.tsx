import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationLink } from "@/lib/notifications";
import { NotificationItem } from "@/components/NotificationItem";
import { MarkAllNotificationsReadButton } from "@/components/MarkAllNotificationsReadButton";
import { FadeIn } from "@/components/FadeIn";

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
          <FadeIn mode="mount" delay={0}>
            <span className="eyebrow">Notifications</span>
          </FadeIn>
          <FadeIn mode="mount" delay={90}>
            <h1 className="heading-tight">Notifications</h1>
          </FadeIn>
        </div>
        {hasUnread && <MarkAllNotificationsReadButton />}
      </div>

      {notifications.length === 0 ? (
        <p>
          You don&apos;t have any notifications yet. Connection requests and
          new messages will show up here.
        </p>
      ) : (
        <FadeIn mode="viewport">
          <div className="notification-list">
            {notifications.map((n) => (
              <FadeIn key={n.id} mode="viewport">
                <NotificationItem
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
              </FadeIn>
            ))}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
