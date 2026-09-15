-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('connection_request', 'connection_accepted', 'connection_declined', 'new_message', 'trip_cancelled', 'trip_seat_confirmed', 'family_invite_accepted', 'parent_link_approved', 'seat_offer_received', 'seat_offer_accepted', 'seat_offer_declined', 'seat_offer_trip_cancelled');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_requestId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_beneficiaryId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_destinationCityId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_originCityId_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_postedById_fkey";

-- DropForeignKey
ALTER TABLE "Request" DROP CONSTRAINT "Request_tripId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_requestId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_revieweeId_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_reviewerId_fkey";

-- DropIndex
DROP INDEX "Conversation_requestId_key";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "requestId";

-- AlterTable
ALTER TABLE "PackagePost" DROP COLUMN "kind";

-- DropTable
DROP TABLE "Request";

-- DropTable
DROP TABLE "Review";

-- DropEnum
DROP TYPE "PackagePostKind";

-- DropEnum
DROP TYPE "RequestStatus";

