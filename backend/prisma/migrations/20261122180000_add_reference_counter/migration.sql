-- CreateTable: ReferenceCounter — single atomic row that hands out permanent
-- 5-digit transaction reference numbers (11111–99999) shared by deposits and
-- withdrawals. The counter only ever advances; allocated numbers are never
-- recycled, even if the transaction they were created for is later rejected,
-- cancelled, or deleted.
CREATE TABLE "ReferenceCounter" (
    "id" TEXT NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 11111,

    CONSTRAINT "ReferenceCounter_pkey" PRIMARY KEY ("id")
);

-- Seed the single counter row at the bottom of the valid range.
INSERT INTO "ReferenceCounter" ("id", "nextValue") VALUES ('global', 11111);
