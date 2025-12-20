ALTER TABLE "users" ADD COLUMN "device_id" VARCHAR(255);
ALTER TABLE "users" ADD CONSTRAINT "uniq_user_device_id" UNIQUE ("device_id");
CREATE INDEX "idx_user_device_id" ON "users"("device_id");