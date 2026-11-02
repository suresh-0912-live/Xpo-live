-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "currency" SET DEFAULT 'INR';

-- Backfill: existing wallets were created when the default was 'USD'.
UPDATE "Wallet" SET "currency" = 'INR' WHERE "currency" = 'USD';
