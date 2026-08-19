import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessageThread } from "@/components/MessageThread";

// A single conversation thread -- reached from /messages or from the
// "Register for a seat" flow on /trips/[id]. 404s (not a permission error
// page) when the caller isn't a participant, so a conversation's existence
// isn't leaked to someone outside it, same as GET /api/conversations/[id].
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      trip: { include: { originCity: true, destinationCity: true } },
      participants: {
        include: { user: { select: { id: true, name: true, photoUrl: true } } },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        include: { sender: { select: { id: true, name: true, photoUrl: true } } },
      },
    },
  });
  const isParticipant = conversation?.participants.some(
    (p) => p.userId === user.id,
  );
  if (!conversation || !isParticipant) notFound();

  const counterpart = conversation.participants.find(
    (p) => p.userId !== user.id,
  )?.user;
  const destinationLabel =
    conversation.trip.destinationCity?.name ??
    conversation.trip.destinationText ??
    "?";

  return (
    <div>
      <p>
        <Link href={`/trips/${conversation.tripId}`}>
          {conversation.trip.originCity.name} → {destinationLabel}
        </Link>
      </p>
      <h1>{counterpart?.name ?? "Conversation"}</h1>
      <MessageThread
        conversationId={conversation.id}
        currentUserId={user.id}
        initialMessages={conversation.messages.map((m) => ({
          id: m.id,
          body: m.body,
          sentAt: m.sentAt.toISOString(),
          senderId: m.senderId,
          sender: m.sender,
        }))}
      />
    </div>
  );
}
