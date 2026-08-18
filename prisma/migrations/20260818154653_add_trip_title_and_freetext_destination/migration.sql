-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_destinationCityId_fkey";

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "destinationText" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "destinationText" TEXT,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "destinationCityId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
