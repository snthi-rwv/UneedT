-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "targetGrade" DOUBLE PRECISION NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "concentration" INTEGER,
ADD COLUMN     "performance" INTEGER;

-- CreateTable
CREATE TABLE "GradeEntry" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "percent" DOUBLE PRECISION NOT NULL,
    "grade" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyDay" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StudyDay_pkey" PRIMARY KEY ("userId","date")
);

-- CreateIndex
CREATE INDEX "GradeEntry_subjectId_order_idx" ON "GradeEntry"("subjectId", "order");

-- AddForeignKey
ALTER TABLE "GradeEntry" ADD CONSTRAINT "GradeEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyDay" ADD CONSTRAINT "StudyDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
