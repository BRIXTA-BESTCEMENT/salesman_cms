-- ========================================================================
-- 1. Modify "projection_vs_actual_reports"
-- ========================================================================

-- Add new columns
ALTER TABLE "projection_vs_actual_reports" ADD COLUMN "verified_dealer_id" INTEGER;
ALTER TABLE "projection_vs_actual_reports" ADD COLUMN "user_id" INTEGER;

-- Create indexes
CREATE INDEX "idx_proj_actual_verified_dealer" ON "projection_vs_actual_reports"("verified_dealer_id");
CREATE INDEX "idx_proj_actual_user" ON "projection_vs_actual_reports"("user_id");

-- Add foreign keys
ALTER TABLE "projection_vs_actual_reports" 
  ADD CONSTRAINT "projection_vs_actual_reports_verified_dealer_id_fkey" 
  FOREIGN KEY ("verified_dealer_id") REFERENCES "verified_dealers"("id") ON DELETE SET NULL;

ALTER TABLE "projection_vs_actual_reports" 
  ADD CONSTRAINT "projection_vs_actual_reports_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;


-- ========================================================================
-- 2. Modify "projection_reports"
-- ========================================================================

-- Drop old dealer foreign key and index
ALTER TABLE "projection_reports" DROP CONSTRAINT IF EXISTS "projection_reports_dealer_id_fkey";
DROP INDEX IF EXISTS "idx_projection_dealer";

-- Drop old dealer column
ALTER TABLE "projection_reports" DROP COLUMN IF EXISTS "dealer_id";

-- Add new columns
ALTER TABLE "projection_reports" ADD COLUMN "verified_dealer_id" INTEGER;
ALTER TABLE "projection_reports" ADD COLUMN "user_id" INTEGER;

-- Create indexes
CREATE INDEX "idx_projection_verified_dealer" ON "projection_reports"("verified_dealer_id");
CREATE INDEX "idx_projection_user" ON "projection_reports"("user_id");

-- Add foreign keys
ALTER TABLE "projection_reports" 
  ADD CONSTRAINT "projection_reports_verified_dealer_id_fkey" 
  FOREIGN KEY ("verified_dealer_id") REFERENCES "verified_dealers"("id") ON DELETE SET NULL;

ALTER TABLE "projection_reports" 
  ADD CONSTRAINT "projection_reports_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;


-- ========================================================================
-- 3. Modify "collection_reports"
-- ========================================================================

-- Drop old dealer foreign key and index
ALTER TABLE "collection_reports" DROP CONSTRAINT IF EXISTS "collection_reports_dealer_id_fkey";
DROP INDEX IF EXISTS "idx_collection_dealer";

-- Drop old dealer column
ALTER TABLE "collection_reports" DROP COLUMN IF EXISTS "dealer_id";

-- Add new columns
ALTER TABLE "collection_reports" ADD COLUMN "verified_dealer_id" INTEGER;
ALTER TABLE "collection_reports" ADD COLUMN "user_id" INTEGER;

-- Create indexes
CREATE INDEX "idx_collection_verified_dealer" ON "collection_reports"("verified_dealer_id");
CREATE INDEX "idx_collection_user" ON "collection_reports"("user_id");

-- Add foreign keys
ALTER TABLE "collection_reports" 
  ADD CONSTRAINT "collection_reports_verified_dealer_id_fkey" 
  FOREIGN KEY ("verified_dealer_id") REFERENCES "verified_dealers"("id") ON DELETE SET NULL;

ALTER TABLE "collection_reports" 
  ADD CONSTRAINT "collection_reports_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
