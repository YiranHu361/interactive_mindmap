-- CreateTable
CREATE TABLE "UserNodeCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "cacheType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNodeCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNodeCache_userId_nodeId_idx" ON "UserNodeCache"("userId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNodeCache_userId_nodeId_cacheType_key" ON "UserNodeCache"("userId", "nodeId", "cacheType");

-- AddForeignKey
ALTER TABLE "UserNodeCache" ADD CONSTRAINT "UserNodeCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNodeCache" ADD CONSTRAINT "UserNodeCache_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
