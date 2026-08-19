import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isConversationUnread } from "@/lib/messaging";

// Messages — conversation list, scoped to (trip, counterpart) pairs. Each
// row links to /messages/[id], which polls for new messages while open
// (see plan doc §14 — polling, not websockets). Unread rows (see
// isConversationUnread, src/lib/messaging.ts) render bold with a "New"
// badge until that thread has actually been opened.
export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    include: {
      trip: { include: { originCity: true, destinationCity: true } },
      // Unfiltered (both participants) -- unlike before this needed only
      // the counterpart's User, this page now also needs the caller's own
      // participant row for its lastReadAt.
      participants: {
        include: { user: { select: { id: true, name: true, photoUrl: true } } },
      },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1>Messages</h1>
      {conversations.length === 0 ? (
        <p>Your conversations will appear here.</p>
      ) : (
        <div className="conversation-list">
          {conversations.map((c) => {
            const counterpart = c.participants.find(
              (p) => p.userId !== user.id,
            )?.user;
            const myParticipant = c.participants.find(
              (p) => p.userId === user.id,
            );
            const lastMessage = c.messages[0];
            const unread = isConversationUnread(
              lastMessage,
              user.id,
              myParticipant?.lastReadAt,
            );
            const destinationLabel =
              c.trip.destinationCity?.name ?? c.trip.destinationText ?? "?";
            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className={
                  unread ? "conversation-item conversation-item-unread" : "conversation-item"
                }
              >
                <div
                  className={
                    unread
                      ? "conversation-item-title conversation-item-title-unread"
                      : "conversation-item-title"
                  }
                >
                  {counterpart?.name ?? "Unknown"}
                  {unread && <span className="unread-badge">New</span>}
                </div>
                <div className="conversation-item-route">
                  {c.trip.originCity.name} → {destinationLabel}
                </div>
                {lastMessage && (
                  <div className="conversation-item-preview">
                    {lastMessage.body}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
