-- 1. Add the new nullable column to the daily_tasks table
ALTER TABLE "daily_tasks" 
ADD COLUMN "related_verified_dealer_id" INTEGER;

-- 2. Create the foreign key constraint linking to verified_dealers
ALTER TABLE "daily_tasks" 
ADD CONSTRAINT "daily_tasks_related_verified_dealer_id_fkey" 
FOREIGN KEY ("related_verified_dealer_id") 
REFERENCES "verified_dealers"("id") 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- 3. Create the index for query optimization
CREATE INDEX "idx_daily_tasks_related_verified_dealer_id" 
ON "daily_tasks"("related_verified_dealer_id");