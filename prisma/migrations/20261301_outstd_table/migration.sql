-- 1. Create the Verified Dealers table
CREATE TABLE "verified_dealers" (
    "id" SERIAL PRIMARY KEY,
    "dealer_code" VARCHAR(255),
    "dealer_party_name" VARCHAR(255),
    "zone" VARCHAR(255),
    "area" VARCHAR(255),
    "contact_no1" VARCHAR(20),
    "contact_no2" VARCHAR(20),
    "email" VARCHAR(255),
    "address" TEXT,
    "pin_code" VARCHAR(20),
    "related_sp_name" VARCHAR(255),
    "owner_proprietor_name" VARCHAR(255),
    "nature_of_firm" VARCHAR(255),
    "gst_no" VARCHAR(50),
    "pan_no" VARCHAR(50),
    "dealer_category" VARCHAR(255),
    "is_subdealer" BOOLEAN,
    "user_id" INTEGER,
    "dealer_id" VARCHAR(255),
    
    CONSTRAINT "fk_verified_dealers_user_id" 
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
    CONSTRAINT "fk_verified_dealers_dealer_id" 
        FOREIGN KEY ("dealer_id") REFERENCES "dealers"("id") ON DELETE SET NULL
);

-- 2. Create the Outstanding Reports table
CREATE TABLE "outstanding_reports" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "security_deposit_amt" NUMERIC(14, 2),
    "pending_amt" NUMERIC(14, 2),
    "less_than_10_days" NUMERIC(14, 2),
    "10_to_15_days" NUMERIC(14, 2),
    "15_to_21_days" NUMERIC(14, 2),
    "21_to_30_days" NUMERIC(14, 2),
    "30_to_45_days" NUMERIC(14, 2),
    "45_to_60_days" NUMERIC(14, 2),
    "60_to_75_days" NUMERIC(14, 2),
    "75_to_90_days" NUMERIC(14, 2),
    "greater_than_90_days" NUMERIC(14, 2),
    "is_overdue" BOOLEAN DEFAULT false,
    "is_account_jsb_jud" BOOLEAN DEFAULT false,
    "verified_dealer_id" INTEGER,
    "collection_report_id" UUID,
    "dvr_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "fk_outstanding_verified_dealer" 
        FOREIGN KEY ("verified_dealer_id") REFERENCES "verified_dealers"("id") ON DELETE SET NULL,
    CONSTRAINT "fk_outstanding_collection_report" 
        FOREIGN KEY ("collection_report_id") REFERENCES "collection_reports"("id") ON DELETE SET NULL,
    CONSTRAINT "fk_outstanding_dvr" 
        FOREIGN KEY ("dvr_id") REFERENCES "daily_visit_reports"("id") ON DELETE SET NULL
);

-- Indexes for Outstanding Reports
CREATE INDEX "idx_outstanding_verified_dealer" ON "outstanding_reports"("verified_dealer_id");
CREATE INDEX "idx_outstanding_collection_report" ON "outstanding_reports"("collection_report_id");
CREATE INDEX "idx_outstanding_dvr" ON "outstanding_reports"("dvr_id");

-- 3. Alter existing Dealer Brand Mapping table
ALTER TABLE "dealer_brand_mapping" 
ADD COLUMN "verified_dealer_id" INTEGER;

-- Add Foreign Key constraint to existing table
ALTER TABLE "dealer_brand_mapping"
ADD CONSTRAINT "fk_dbm_verified_dealer" 
    FOREIGN KEY ("verified_dealer_id") REFERENCES "verified_dealers"("id") ON DELETE SET NULL;

-- Index for the new column on Dealer Brand Mapping
CREATE INDEX "idx_dbm_verified_dealer_id" ON "dealer_brand_mapping"("verified_dealer_id");