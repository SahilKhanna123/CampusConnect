import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessageThread } from "@/components/MessageThread";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";
import { tripDisplayStatus } from "@/lib/postStatus";
import { SeatOfferButton, type SeatOfferStatus } from "@/components/SeatOfferButton";
import { RespondToSeatOfferButtons } from "@/components/RespondToSeatOfferButtons";

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
  const initialBlocked = counterpart
    ? await isBlockedBetween(user.id, counterpart.id)
    : false;
  const destinationLabel =
    conversation.trip.destinationCity?.name ??
    conversation.trip.destinationText ??
    "?";

  const isOwner = conversation.trip.travelerId === user.id;
  // Most recent SeatOffer for this conversation -- there can be more than
  // one over time (a fresh offer is sendable again after a decline/cancel,
  // same as ConnectionRequest), so the latest row is the one that matters.
  const latestSeatOffer = await prisma.seatOffer.findFirst({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "desc" },
  });
  const seatOfferStatus: SeatOfferStatus = latestSeatOffer?.status ?? "none";

  return (
    <div>
      {/* Shown every time a chat is opened, before the thread itself --
          this app has no payment/escrow infrastructure (see CLAUDE.md,
          "No payment fields"), so any money changing hands is strictly an
          in-person, off-platform arrangement between the two riders. */}
      <p className="chat-safety-notice">
        ⚠️ Safety notice: Handle any payment (gas money, delivery fees, etc.)
        in person, at the time of the ride or pickup. CampusConnect doesn't
        process payments and can't help recover money sent to someone here.
      </p>
      <p>
        <Link href={`/trips/${conversation.tripId}`}>
          {conversation.trip.originCity.name} → {destinationLabel}
        </Link>
      </p>
      <h1>{counterpart?.name ?? "Conversation"}</h1>
      {counterpart && (
        <>
          <ReportButton
            reportedUserId={counterpart.id}
            contextType="message"
            contextId={conversation.id}
          />{" "}
          <BlockButton
            blockedUserId={counterpart.id}
            initialBlocked={initialBlocked}
          />
        </>
      )}

      {isOwner && (
        <div>
          <SeatOfferButton
            conversationId={conversation.id}
            initialStatus={seatOfferStatus}
            initialSeatOfferId={latestSeatOffer?.id}
            seatsAvailable={
              conversation.trip.seatsRemaining > 0 &&
              tripDisplayStatus(conversation.trip) === "upcoming"
            }
          />
        </div>
      )}

      {!isOwner && latestSeatOffer?.recipientId === user.id && (
        <div>
          {seatOfferStatus === "pending" && (
            <RespondToSeatOfferButtons seatOfferId={latestSeatOffer.id} />
          )}
          {seatOfferStatus === "accepted" && (
            <p className="seat-confirmed-badge">
              ✓ You have a confirmed seat on this trip.
            </p>
          )}
        </div>
      )}
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
