-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceFile" TEXT,
    "transactionDate" DATETIME NOT NULL,
    "valueDate" DATETIME,
    "counterparty" TEXT NOT NULL,
    "counterpartyIban" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "purpose" TEXT,
    "matchedInvoiceId" TEXT,
    "matchConfidence" REAL,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "syncVersion" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "BankTransaction_transactionDate_idx" ON "BankTransaction"("transactionDate");

-- CreateIndex
CREATE INDEX "BankTransaction_matchedInvoiceId_idx" ON "BankTransaction"("matchedInvoiceId");

-- CreateIndex
CREATE INDEX "BankTransaction_reconciled_idx" ON "BankTransaction"("reconciled");

-- CreateIndex
CREATE INDEX "BankTransaction_deletedAt_idx" ON "BankTransaction"("deletedAt");
