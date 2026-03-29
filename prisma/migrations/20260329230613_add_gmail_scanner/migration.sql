-- CreateTable
CREATE TABLE "GmailConnection" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailScanResult" (
    "id" TEXT NOT NULL,
    "gmailEmail" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "parsedVendor" TEXT,
    "parsedAmount" DECIMAL(18,4),
    "parsedCurrency" TEXT,
    "parsedDate" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expenseId" TEXT,
    "rawSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailScanResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GmailConnection_email_key" ON "GmailConnection"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EmailScanResult_gmailMessageId_key" ON "EmailScanResult"("gmailMessageId");

-- CreateIndex
CREATE INDEX "EmailScanResult_gmailEmail_idx" ON "EmailScanResult"("gmailEmail");

-- CreateIndex
CREATE INDEX "EmailScanResult_status_idx" ON "EmailScanResult"("status");
