-- CreateTable: call_logs for Phone Agent tracking
CREATE TABLE IF NOT EXISTS "call_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "call_type" VARCHAR(50) NOT NULL,
    "call_id" VARCHAR(100) UNIQUE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'initiated',
    "script_used" TEXT,
    "transcript" TEXT,
    "duration_seconds" INTEGER,
    "outcome_analysis" TEXT,
    "next_action" TEXT,
    "sentiment" VARCHAR(20),
    "initiated_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable: appointments for appointment reminders
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID,
    "appointment_date" DATE NOT NULL,
    "appointment_time" TIME NOT NULL,
    "description" TEXT,
    "location" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_logs_customer_id_idx" ON "call_logs"("customer_id");
CREATE INDEX "call_logs_call_type_idx" ON "call_logs"("call_type");
CREATE INDEX "call_logs_status_idx" ON "call_logs"("status");
CREATE INDEX "call_logs_initiated_at_idx" ON "call_logs"("initiated_at");

CREATE INDEX "appointments_customer_id_idx" ON "appointments"("customer_id");
CREATE INDEX "appointments_appointment_date_idx" ON "appointments"("appointment_date");
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- AddForeignKey (if customers table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
        ALTER TABLE "call_logs"
        ADD CONSTRAINT "call_logs_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

        ALTER TABLE "appointments"
        ADD CONSTRAINT "appointments_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
