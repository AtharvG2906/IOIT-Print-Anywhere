-- OTPs are now sent by email instead of SMS.

-- Keep existing users' verification timestamp under its new name.
ALTER TABLE "User" RENAME COLUMN "phoneVerifiedAt" TO "emailVerifiedAt";

-- OTP codes now target an email address. Old phone-based codes are useless, so clear them.
DELETE FROM "OtpCode";
ALTER TABLE "OtpCode" RENAME COLUMN "phone" TO "target";
ALTER INDEX "OtpCode_phone_purpose_createdAt_idx" RENAME TO "OtpCode_target_purpose_createdAt_idx";

-- Single-page signup no longer needs pending signups.
DROP TABLE "PendingSignup";
