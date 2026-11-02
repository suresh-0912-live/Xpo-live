ALTER TABLE "PasswordReset"
ADD COLUMN "revokedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "NotificationDelivery"
    GROUP BY "notificationId", "userId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add notification delivery uniqueness: duplicate recipient rows exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "NotificationDelivery_notificationId_userId_key"
ON "NotificationDelivery"("notificationId", "userId");

CREATE UNIQUE INDEX "PasswordReset_tokenHash_key"
ON "PasswordReset"("tokenHash");
