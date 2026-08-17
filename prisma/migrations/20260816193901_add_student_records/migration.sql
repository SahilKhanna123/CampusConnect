-- AlterEnum
BEGIN;
CREATE TYPE "ParentStudentLinkStatus_new" AS ENUM ('otp_verified', 'approved', 'revoked');
ALTER TABLE "ParentStudentLink" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ParentStudentLink" ALTER COLUMN "status" TYPE "ParentStudentLinkStatus_new" USING ("status"::text::"ParentStudentLinkStatus_new");
ALTER TYPE "ParentStudentLinkStatus" RENAME TO "ParentStudentLinkStatus_old";
ALTER TYPE "ParentStudentLinkStatus_new" RENAME TO "ParentStudentLinkStatus";
DROP TYPE "ParentStudentLinkStatus_old";
ALTER TABLE "ParentStudentLink" ALTER COLUMN "status" SET DEFAULT 'otp_verified';
COMMIT;

-- DropForeignKey
ALTER TABLE "ParentStudentLink" DROP CONSTRAINT "ParentStudentLink_studentId_fkey";

-- DropIndex
DROP INDEX "ParentStudentLink_parentId_studentId_key";

-- AlterTable
ALTER TABLE "ParentStudentLink" DROP COLUMN "studentId",
ADD COLUMN     "objectionToken" TEXT,
ADD COLUMN     "otpVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "studentRecordId" TEXT NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'otp_verified';

-- CreateTable
CREATE TABLE "StudentRecord" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "universityEmail" TEXT NOT NULL,
    "universityDomainId" TEXT NOT NULL,
    "universityEmailVerifiedAt" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentStudentOtpRequest" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "universityDomainId" TEXT NOT NULL,
    "otpCodeHash" TEXT NOT NULL,
    "otpExpiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentStudentOtpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentRecord_universityEmail_key" ON "StudentRecord"("universityEmail");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRecord_userId_key" ON "StudentRecord"("userId");

-- CreateIndex
CREATE INDEX "StudentRecord_universityDomainId_idx" ON "StudentRecord"("universityDomainId");

-- CreateIndex
CREATE INDEX "ParentStudentOtpRequest_parentId_idx" ON "ParentStudentOtpRequest"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentLink_objectionToken_key" ON "ParentStudentLink"("objectionToken");

-- CreateIndex
CREATE INDEX "ParentStudentLink_studentRecordId_idx" ON "ParentStudentLink"("studentRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentStudentLink_parentId_studentRecordId_key" ON "ParentStudentLink"("parentId", "studentRecordId");

-- AddForeignKey
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_universityDomainId_fkey" FOREIGN KEY ("universityDomainId") REFERENCES "SupportedUniversityDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRecord" ADD CONSTRAINT "StudentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentOtpRequest" ADD CONSTRAINT "ParentStudentOtpRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentOtpRequest" ADD CONSTRAINT "ParentStudentOtpRequest_universityDomainId_fkey" FOREIGN KEY ("universityDomainId") REFERENCES "SupportedUniversityDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentStudentLink" ADD CONSTRAINT "ParentStudentLink_studentRecordId_fkey" FOREIGN KEY ("studentRecordId") REFERENCES "StudentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

