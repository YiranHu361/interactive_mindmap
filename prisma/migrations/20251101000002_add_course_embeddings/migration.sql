-- AlterTable
ALTER TABLE "berkeley_courses" ADD COLUMN "embedding" vector(1536);

-- CreateIndex
CREATE INDEX "berkeley_courses_embedding_idx" ON "berkeley_courses" USING ivfflat ("embedding");

