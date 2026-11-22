-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "referenceNumber" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_referenceNumber_key" ON "Transaction"("referenceNumber");
