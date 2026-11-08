-- CreateEnum
CREATE TYPE "PlanIntensity" AS ENUM ('LIGHT', 'NORMAL', 'INTENSE');

-- AlterTable
ALTER TABLE "StudyPlan" ADD COLUMN     "endTime" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "intensity" "PlanIntensity" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "startTime" TEXT NOT NULL DEFAULT '08:00';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "aiAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "aiReason" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiPrioritizedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TaskGuide" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '',
    "sourceName" TEXT,
    "sourceText" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "usedAi" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskGuide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideStep" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "minutes" INTEGER NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),
    "spentSeconds" INTEGER NOT NULL DEFAULT 0,
    "runningSince" TIMESTAMP(3),
    "creditedSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GuideStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskGuide_taskId_key" ON "TaskGuide"("taskId");

-- CreateIndex
CREATE INDEX "TaskGuide_userId_idx" ON "TaskGuide"("userId");

-- CreateIndex
CREATE INDEX "GuideStep_guideId_order_idx" ON "GuideStep"("guideId", "order");

-- AddForeignKey
ALTER TABLE "TaskGuide" ADD CONSTRAINT "TaskGuide_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskGuide" ADD CONSTRAINT "TaskGuide_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideStep" ADD CONSTRAINT "GuideStep_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "TaskGuide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
