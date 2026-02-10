-- AlterTable
ALTER TABLE "License" ADD COLUMN "stripeCustomerId" TEXT;

-- CreateIndex (optional, for faster lookups by customer ID)
CREATE INDEX "License_stripeCustomerId_idx" ON "License"("stripeCustomerId");
