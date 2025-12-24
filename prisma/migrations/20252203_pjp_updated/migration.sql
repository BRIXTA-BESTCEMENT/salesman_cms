ALTER TABLE "permanent_journey_plans" 
ADD COLUMN IF NOT EXISTS "route" VARCHAR(500),
ADD COLUMN IF NOT EXISTS "planned_new_site_visits" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "planned_follow_up_site_visits" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "planned_new_dealer_visits" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "planned_influencer_visits" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "influencer_name" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "influencer_phone" VARCHAR(20),
ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(255),
ADD COLUMN IF NOT EXISTS "noof_converted_bags" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "noof_masonpc_in_schemes" INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS "diversion_reason" VARCHAR(500);