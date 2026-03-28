-- CreateSchema
CREATE TYPE "BillingAccount" AS ENUM ('NORFOLK_GROUP', 'NORFOLK_AI', 'CIDALE');

CREATE TYPE "AiProvider" AS ENUM (
  'CURSOR',
  'ANTHROPIC',
  'OPENAI',
  'GOOGLE_API',
  'GEMINI',
  'MANUS',
  'REPLIT',
  'VERCEL',
  'ELEVENLABS',
  'PERPLEXITY',
  'MIDJOURNEY',
  'AWS_BEDROCK',
  'MISTRAL',
  'COHERE',
  'OTHER'
);

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "billingAccount" "BillingAccount" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "label" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Expense_provider_externalRef_key" ON "Expense"("provider", "externalRef");

CREATE INDEX "Expense_incurredAt_idx" ON "Expense"("incurredAt");
CREATE INDEX "Expense_provider_idx" ON "Expense"("provider");
CREATE INDEX "Expense_billingAccount_idx" ON "Expense"("billingAccount");

CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL,
    "message" TEXT,
    "imported" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);
