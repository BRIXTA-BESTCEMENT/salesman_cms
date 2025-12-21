ALTER TABLE "mason_pc_side" 
ADD COLUMN IF NOT EXISTS "device_id" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "fcm_token" VARCHAR(500);

-- Adding the unique constraint for device_id
ALTER TABLE "mason_pc_side" 
ADD CONSTRAINT "mason_pc_side_device_id_unique" UNIQUE ("device_id");