-- Local xpo_dev migration: add user-held security verification and the
-- admin-reviewed recovery lifecycle. Existing users remain nullable until
-- they establish a security question through an account migration flow.
ALTER TABLE "User"
ADD COLUMN "securityQuestion" TEXT,
ADD COLUMN "securityAnswerHash" TEXT,
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PasswordReset"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "approvedAt" TIMESTAMP(3),
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "rejectedBy" TEXT,
ADD COLUMN "securityAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedAt" TIMESTAMP(3);

CREATE INDEX "PasswordReset_status_createdAt_idx" ON "PasswordReset"("status", "createdAt");
