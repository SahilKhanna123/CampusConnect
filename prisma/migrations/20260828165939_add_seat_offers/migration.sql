-- New notification events for the owner-initiated Seat Offers feature --
-- see the Seat Offers section of CLAUDE.md and POST /api/seat-offers.
-- Additive-only, same lightweight ALTER TYPE ... ADD VALUE mechanic as
-- every prior NotificationType addition this session, rather than a full
-- enum rebuild.
ALTER TYPE "NotificationType" ADD VALUE 'seat_offer_received';
ALTER TYPE "NotificationType" ADD VALUE 'seat_offer_accepted';
ALTER TYPE "NotificationType" ADD VALUE 'seat_offer_declined';

-- CreateEnum
CREATE TYPE "SeatOfferStatus" AS ENUM ('pending', 'accepted', 'declined', 'cancelled');

-- CreateTable
CREATE TABLE "SeatOffer" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "SeatOfferStatus" NOT NULL DEFAULT 'pending',
    "seatConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "SeatOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeatOffer_tripId_idx" ON "SeatOffer"("tripId");

-- CreateIndex
CREATE INDEX "SeatOffer_recipientId_idx" ON "SeatOffer"("recipientId");

-- CreateIndex
CREATE INDEX "SeatOffer_conversationId_idx" ON "SeatOffer"("conversationId");

-- AddForeignKey
ALTER TABLE "SeatOffer" ADD CONSTRAINT "SeatOffer_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatOffer" ADD CONSTRAINT "SeatOffer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatOffer" ADD CONSTRAINT "SeatOffer_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
