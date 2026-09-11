-- CreateEnum
CREATE TYPE "TripCategory" AS ENUM ('personal_car', 'uber_share');

-- CreateEnum
CREATE TYPE "PackagePostKind" AS ENUM ('offering_space', 'needing_delivery');

-- CreateEnum
CREATE TYPE "PackagePostStatus" AS ENUM ('open', 'completed', 'cancelled');

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_tripId_fkey";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "packagePostId" TEXT,
ALTER COLUMN "tripId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Request" DROP COLUMN "neededByDate",
DROP COLUMN "packageDescription",
DROP COLUMN "packageSize",
DROP COLUMN "type",
ADD COLUMN     "category" "TripCategory" NOT NULL DEFAULT 'personal_car',
ADD COLUMN     "estimatedFarePerSeat" DECIMAL(6,2);

-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "packageCapacityNote",
DROP COLUMN "packageSpaceAvailable",
ADD COLUMN     "category" "TripCategory" NOT NULL DEFAULT 'personal_car',
ADD COLUMN     "estimatedFarePerSeat" DECIMAL(6,2),
ADD COLUMN     "meetingPoint" VARCHAR(200);

-- DropEnum
DROP TYPE "RequestType";

-- CreateTable
CREATE TABLE "PackagePost" (
    "id" TEXT NOT NULL,
    "kind" "PackagePostKind" NOT NULL,
    "postedById" TEXT NOT NULL,
    "originCityId" TEXT NOT NULL,
    "destinationCityId" TEXT,
    "destinationText" TEXT,
    "date" TIMESTAMP(3),
    "time" TEXT,
    "flexibleTime" BOOLEAN NOT NULL DEFAULT false,
    "notes" VARCHAR(300),
    "studentsOnly" BOOLEAN NOT NULL DEFAULT false,
    "status" "PackagePostStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PackagePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackagePost_postedById_idx" ON "PackagePost"("postedById");

-- CreateIndex
CREATE INDEX "PackagePost_originCityId_destinationCityId_date_idx" ON "PackagePost"("originCityId", "destinationCityId", "date");

-- CreateIndex
CREATE INDEX "Conversation_packagePostId_idx" ON "Conversation"("packagePostId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_packagePostId_fkey" FOREIGN KEY ("packagePostId") REFERENCES "PackagePost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePost" ADD CONSTRAINT "PackagePost_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePost" ADD CONSTRAINT "PackagePost_originCityId_fkey" FOREIGN KEY ("originCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackagePost" ADD CONSTRAINT "PackagePost_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

