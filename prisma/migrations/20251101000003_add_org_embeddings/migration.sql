-- AlterTable
ALTER TABLE "berkeley_organizations" ADD COLUMN "embedding" vector(1536);

-- CreateIndex
CREATE INDEX "berkeley_organizations_embedding_idx" ON "berkeley_organizations" USING ivfflat ("embedding");

