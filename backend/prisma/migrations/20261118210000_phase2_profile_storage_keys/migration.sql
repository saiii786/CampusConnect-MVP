-- AlterTable
ALTER TABLE "PortfolioItem" ADD COLUMN     "imageKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "avatarKey" TEXT,
ADD COLUMN     "studentEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Profile_studentEmail_key" ON "Profile"("studentEmail");
