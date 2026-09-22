import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isConversationUnread, formatConversationTimestamp } from "@/lib/messaging";
import { ConversationActions } from "@/components/ConversationActions";
import { FadeIn } from "@/components/FadeIn";

// Messages — conversation list, scoped to (trip, counterpart) pairs. Each
// row links to /messages/[id], which polls for new messages while open
// (see plan doc §14 — polling, not websockets). Unread rows (see
// isConversationUnread, src/lib/messaging.ts) render bold with a "New"
// badge until that thread has actually been opened.
//
// Inbox/Archived tabs are a plain ?tab= query param, same zero-JS
// server-rendered convention /my-posts and /connections already use for
// their own tabs -- both scoped to conversations the caller hasn't deleted
// (deletedAt null); Inbox additionally excludes archived ones, Archived
// shows only archived ones. A conversation the caller deleted disappears
// from both tabs entirely (see DELETE /api/conversations/[id]).
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { tab } = await searchParams;
  const activeTab = tab === "archived" ? "archived" : "inbox";

  const conversations = await prisma.conversation.findMany({
    where: {
      participants: {
        some: {
          userId: user.id,
          deletedAt: null,
          archivedAt: activeTab === "archived" ? { not: null } : null,
        },
      },
    },
    include: {
      trip: { include: { originCity: true, destinationCity: true } },
      // A conversation is scoped to exactly one of trip/packagePost --
      // see the schema comment on Conversation.packagePostId.
      packagePost: { include: { originCity: true, destinationCity: true } },
      // Unfiltered (both participants) -- unlike before this needed only
      // the counterpart's User, this page now also needs the caller's own
      // participant row for its lastReadAt/archivedAt.
      participants: {
        include: { user: { select: { id: true, name: true, photoUrl: true } } },
      },
      messages: { orderBy: { sentAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <FadeIn mode="mount" delay={0}>
        <span className="eyebrow">Messages</span>
      </FadeIn>
      <FadeIn mode="mount" delay={90}>
        <h1 className="heading-tight">Messages</h1>
      </FadeIn>

      <div className="subtabs" aria-label="Messages view">
        <Link
          href="/messages"
          aria-current={activeTab === "inbox" ? "page" : undefined}
          className={activeTab === "inbox" ? "subtab subtab-active" : "subtab"}
        >
          Inbox
        </Link>
        <Link
          href="/messages?tab=archived"
          aria-current={activeTab === "archived" ? "page" : undefined}
          className={activeTab === "archived" ? "subtab subtab-active" : "subtab"}
        >
          Archived
        </Link>
      </div>

      {conversations.length === 0 ? (
        <p>
          {activeTab === "archived"
            ? "No archived conversations."
            : "Your conversations will appear here."}
        </p>
      ) : (
        <FadeIn mode="viewport">
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
              const post = c.trip ?? c.packagePost!;
              const destinationLabel =
                post.destinationCity?.name ?? post.destinationText ?? "?";
              const lastActivityAt = lastMessage?.sentAt ?? c.createdAt;
              return (
                <FadeIn key={c.id} mode="viewport">
                  <div
                    className={
                      unread ? "conversation-item conversation-item-unread" : "conversation-item"
                    }
                  >
                    <Link href={`/messages/${c.id}`} className="conversation-item-link">
                      <div className="conversation-item-header">
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
                        <div className="conversation-item-meta">
                          {formatConversationTimestamp(lastActivityAt)}
                        </div>
                      </div>
                      <div className="conversation-item-route">
                        {post.originCity.name} → {destinationLabel}
                      </div>
                      {lastMessage && (
                        <div className="conversation-item-preview">
                          {lastMessage.body}
                        </div>
                      )}
                    </Link>
                    <ConversationActions
                      conversationId={c.id}
                      initialArchived={!!myParticipant?.archivedAt}
                    />
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </FadeIn>
      )}
    </div>
  );
}
