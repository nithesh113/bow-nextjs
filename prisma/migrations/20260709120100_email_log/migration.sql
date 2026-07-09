-- CreateTable
CREATE TABLE "email_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "to" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "error" TEXT,
    "subject" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_log_created_at_desc_idx" ON "email_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "email_log_to_idx" ON "email_log"("to");

-- CreateIndex
CREATE INDEX "email_log_status_idx" ON "email_log"("status");

-- CreateIndex
CREATE INDEX "email_log_type_idx" ON "email_log"("type");

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

