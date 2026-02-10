-- 1. Update collection_reports
ALTER TABLE "collection_reports" ALTER COLUMN "institution" DROP NOT NULL;

-- 2. Update projection_vs_actual_reports
ALTER TABLE "projection_vs_actual_reports" ALTER COLUMN "institution" DROP NOT NULL;

-- 3. Update projection_reports
ALTER TABLE "projection_reports" ALTER COLUMN "institution" DROP NOT NULL;