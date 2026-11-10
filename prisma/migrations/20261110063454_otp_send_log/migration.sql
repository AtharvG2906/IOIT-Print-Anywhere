-- CreateTable
CREATE TABLE "OtpSend" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OtpSend_target_createdAt_idx" ON "OtpSend"("target", "createdAt");
