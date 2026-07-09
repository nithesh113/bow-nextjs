-- CreateTable
CREATE TABLE "user_feedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_feedback_user_idx" ON "user_feedback"("userId");

-- CreateIndex
CREATE INDEX "user_feedback_type_idx" ON "user_feedback"("type");

-- CreateIndex
CREATE INDEX "user_feedback_status_idx" ON "user_feedback"("status");

-- CreateIndex
CREATE INDEX "user_feedback_created_at_desc_idx" ON "user_feedback"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

