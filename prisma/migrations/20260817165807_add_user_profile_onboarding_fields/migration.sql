-- AlterTable
ALTER TABLE "User" ADD COLUMN     "homeCityId" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_homeCityId_idx" ON "User"("homeCityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_homeCityId_fkey" FOREIGN KEY ("homeCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;
