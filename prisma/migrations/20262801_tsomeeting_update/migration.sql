-- 1. Drop the fields you no longer need
ALTER TABLE "tso_meetings" 
DROP COLUMN IF EXISTS "location",
DROP COLUMN IF EXISTS "budget_allocated";

-- 2. Add the new fields (all optional/nullable)
ALTER TABLE "tso_meetings"
ADD COLUMN "zone" VARCHAR(100),
ADD COLUMN "market" VARCHAR(100),
ADD COLUMN "dealer_name" VARCHAR(255),
ADD COLUMN "dealer_address" VARCHAR(500),
ADD COLUMN "conducted_by" VARCHAR(255),
ADD COLUMN "gift_type" VARCHAR(255),
ADD COLUMN "account_jsb_jud" VARCHAR(100),
ADD COLUMN "total_expenses" DECIMAL(12, 2),
ADD COLUMN "bill_submitted" BOOLEAN DEFAULT false;

-- 3. Modify existing columns to ensure they are optional (Nullable)
-- (Only 'id' and 'created_by_user_id' remain mandatory)
ALTER TABLE "tso_meetings"
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "date" DROP NOT NULL,
ALTER COLUMN "participants_count" DROP NOT NULL,
ALTER COLUMN "site_id" DROP NOT NULL;