-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lookingFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "major" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "travelPreferences" TEXT,
ADD COLUMN     "year" TEXT;
