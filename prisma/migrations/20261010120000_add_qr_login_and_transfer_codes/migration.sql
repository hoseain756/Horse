-- QR sign-in (TV/laptop approves from a logged-in phone) + addon transfer codes.
-- CreateTable
CREATE TABLE "QrLogin" (
    "code" TEXT NOT NULL,
    "pollHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "userId" TEXT,
    "deviceHint" TEXT,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrLogin_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "TransferCode" (
    "code" TEXT NOT NULL,
    "payloadEnc" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "senderHint" TEXT,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferCode_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "QrLogin_pollHash_idx" ON "QrLogin"("pollHash");

-- CreateIndex
CREATE INDEX "QrLogin_expiresAt_idx" ON "QrLogin"("expiresAt");

-- CreateIndex
CREATE INDEX "TransferCode_expiresAt_idx" ON "TransferCode"("expiresAt");
