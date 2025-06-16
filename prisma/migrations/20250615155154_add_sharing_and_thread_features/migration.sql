-- CreateEnum
CREATE TYPE "Permission" AS ENUM ('VIEW', 'COMMENT', 'EDIT', 'ADMIN');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "isShared" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shareId" TEXT;

-- CreateTable
CREATE TABLE "SharedTask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedCategory" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sharedWithId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL DEFAULT 'VIEW',
    "shareId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadMessage" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadImage" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThreadImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPermission" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Task_shareId_key" ON "Task"("shareId");

-- CreateIndex
CREATE INDEX "Task_shareId_idx" ON "Task"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedTask_taskId_sharedWithId_key" ON "SharedTask"("taskId", "sharedWithId");

-- CreateIndex
CREATE INDEX "SharedTask_taskId_idx" ON "SharedTask"("taskId");

-- CreateIndex
CREATE INDEX "SharedTask_sharedWithId_idx" ON "SharedTask"("sharedWithId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedCategory_shareId_key" ON "SharedCategory"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedCategory_category_ownerId_sharedWithId_key" ON "SharedCategory"("category", "ownerId", "sharedWithId");

-- CreateIndex
CREATE INDEX "SharedCategory_category_idx" ON "SharedCategory"("category");

-- CreateIndex
CREATE INDEX "SharedCategory_ownerId_idx" ON "SharedCategory"("ownerId");

-- CreateIndex
CREATE INDEX "SharedCategory_sharedWithId_idx" ON "SharedCategory"("sharedWithId");

-- CreateIndex
CREATE INDEX "SharedCategory_shareId_idx" ON "SharedCategory"("shareId");

-- CreateIndex
CREATE INDEX "ThreadMessage_taskId_idx" ON "ThreadMessage"("taskId");

-- CreateIndex
CREATE INDEX "ThreadMessage_userId_idx" ON "ThreadMessage"("userId");

-- CreateIndex
CREATE INDEX "ThreadImage_messageId_idx" ON "ThreadImage"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskPermission_taskId_userId_key" ON "TaskPermission"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskPermission_taskId_idx" ON "TaskPermission"("taskId");

-- CreateIndex
CREATE INDEX "TaskPermission_userId_idx" ON "TaskPermission"("userId");

-- AddForeignKey
ALTER TABLE "SharedTask" ADD CONSTRAINT "SharedTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedTask" ADD CONSTRAINT "SharedTask_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedCategory" ADD CONSTRAINT "SharedCategory_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadMessage" ADD CONSTRAINT "ThreadMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadImage" ADD CONSTRAINT "ThreadImage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ThreadMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPermission" ADD CONSTRAINT "TaskPermission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPermission" ADD CONSTRAINT "TaskPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;