-- Add uniqueId and originalUniqueId to Task
ALTER TABLE "Task" ADD COLUMN "uniqueId" TEXT;
ALTER TABLE "Task" ADD COLUMN "originalUniqueId" TEXT;

-- Add importedFromTaskId and importedFromUserId (if not exists)
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "importedFromTaskId" TEXT;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "importedFromUserId" TEXT;

-- Set unique values for existing tasks
UPDATE "Task" SET "uniqueId" = gen_random_uuid()::text WHERE "uniqueId" IS NULL;

-- Make uniqueId required and unique
ALTER TABLE "Task" ALTER COLUMN "uniqueId" SET NOT NULL;
ALTER TABLE "Task" ADD CONSTRAINT "Task_uniqueId_key" UNIQUE ("uniqueId");

-- Create indexes
CREATE INDEX "Task_uniqueId_idx" ON "Task"("uniqueId");
CREATE INDEX "Task_originalUniqueId_idx" ON "Task"("originalUniqueId");
CREATE INDEX IF NOT EXISTS "Task_importedFromTaskId_idx" ON "Task"("importedFromTaskId");
CREATE INDEX IF NOT EXISTS "Task_importedFromUserId_idx" ON "Task"("importedFromUserId");

-- Create Category table
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uniqueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints and indexes for Category
CREATE UNIQUE INDEX "Category_uniqueId_key" ON "Category"("uniqueId");
CREATE UNIQUE INDEX "Category_name_userId_key" ON "Category"("name", "userId");
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE INDEX "Category_uniqueId_idx" ON "Category"("uniqueId");

-- Add foreign key for Category
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add categoryUniqueId to SharedCategory
ALTER TABLE "SharedCategory" ADD COLUMN "categoryUniqueId" TEXT;
CREATE INDEX "SharedCategory_categoryUniqueId_idx" ON "SharedCategory"("categoryUniqueId");

-- Migrate existing categories to Category table
INSERT INTO "Category" ("id", "name", "uniqueId", "userId", "createdAt", "updatedAt")
SELECT DISTINCT ON (t."category", t."userId") 
    gen_random_uuid()::text,
    t."category",
    gen_random_uuid()::text,
    t."userId",
    MIN(t."createdAt"),
    MAX(t."updatedAt")
FROM "Task" t
WHERE t."category" IS NOT NULL
GROUP BY t."category", t."userId";

-- Add unique constraint for SharedCategory
CREATE UNIQUE INDEX "SharedCategory_shareId_sharedWithId_key" ON "SharedCategory"("shareId", "sharedWithId");

-- Add foreign keys for imported tasks (if not exists)
ALTER TABLE "Task" ADD CONSTRAINT "Task_importedFromUserId_fkey" FOREIGN KEY ("importedFromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_importedFromTaskId_fkey" FOREIGN KEY ("importedFromTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;