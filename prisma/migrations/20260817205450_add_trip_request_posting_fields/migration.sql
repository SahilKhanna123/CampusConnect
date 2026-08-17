-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "flexibleTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "neededTime" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "flexibleTime" BOOLEAN NOT NULL DEFAULT false;
