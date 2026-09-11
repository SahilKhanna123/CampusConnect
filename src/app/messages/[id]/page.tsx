import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessageThread } from "@/components/MessageThread";
import { ReportButton } from "@/components/ReportButton";
import { BlockButton } from "@/components/BlockButton";
import { isBlockedBetween } from "@/lib/blocks";
import { tripDisplayStatus } from "@/lib/postStatus";

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
      // A conversation is scoped to exactly one of trip/packagePost, never
      // both -- see the schema comment on Conversation.packagePostId.
      packagePost: { include: { originCity: true, destinationCity: true } },
      participants: {
        include: { user: { select: { id: true, name: true, photoUrl: true } } },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        include: { sender: { select: { id: true, name: true, photoUrl: true } } },
      },
      // Rendered as inline bubbles in MessageThread, see the Seat Offers
      // section of CLAUDE.md -- the full history, not just the latest, so
      // past declined/cancelled offers stay visible in the thread. Always
      // empty for a package conversation -- PackagePost never creates a
      // SeatOffer row (no seat/capacity concept exists for it at all).
      seatOffers: { orderBy: { createdAt: "asc" } },
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

  const { trip, packagePost } = conversation;
  const routeHref = trip ? `/trips/${trip.id}` : `/package-posts/${packagePost!.id}`;
  const originName = trip ? trip.originCity.name : packagePost!.originCity.name;
  const destinationLabel = trip
    ? (trip.destinationCity?.name ?? trip.destinationText ?? "?")
    : (packagePost!.destinationCity?.name ?? packagePost!.destinationText ?? "?");
  const isOwner = trip
    ? trip.travelerId === user.id
    : packagePost!.postedById === user.id;
  const seatsAvailable = trip
    ? trip.seatsRemaining > 0 && tripDisplayStatus(trip) === "upcoming"
    : false;

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
      <div className="detail-header">
        <Link href={routeHref} className="detail-route-subtitle">
          {originName} → {destinationLabel}
        </Link>
        <h1 className="heading-tight detail-route-headline">
          {counterpart?.name ?? "Conversation"}
        </h1>
      </div>
      {counterpart && (
        <div className="button-row">
          <ReportButton
            reportedUserId={counterpart.id}
            contextType="message"
            contextId={conversation.id}
          />
          <BlockButton
            blockedUserId={counterpart.id}
            initialBlocked={initialBlocked}
          />
        </div>
      )}

      {counterpart && (
        <MessageThread
          conversationId={conversation.id}
          currentUserId={user.id}
          isOwner={isOwner}
          counterpartId={counterpart.id}
          seatsAvailable={seatsAvailable}
          initialMessages={conversation.messages.map((m) => ({
            id: m.id,
            body: m.body,
            sentAt: m.sentAt.toISOString(),
            senderId: m.senderId,
            sender: m.sender,
          }))}
          initialSeatOffers={conversation.seatOffers.map((o) => ({
            id: o.id,
            status: o.status,
            recipientId: o.recipientId,
            createdAt: o.createdAt.toISOString(),
            respondedAt: o.respondedAt ? o.respondedAt.toISOString() : null,
            seatConfirmedAt: o.seatConfirmedAt ? o.seatConfirmedAt.toISOString() : null,
          }))}
        />
      )}
    </div>
  );
}
