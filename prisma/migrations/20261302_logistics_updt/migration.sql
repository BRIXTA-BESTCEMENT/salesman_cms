-- 1. Rename the existing table
ALTER TABLE "logistics_gate_io" RENAME TO "logistics_io";

-- 2. Add the new optional columns
ALTER TABLE "logistics_io" 
  ADD COLUMN "purpose" VARCHAR(255),
  ADD COLUMN "type_of_materials" VARCHAR(255),
  ADD COLUMN "vehicle_number" VARCHAR(100),
  ADD COLUMN "store_date" DATE,
  ADD COLUMN "store_time" VARCHAR(50),
  ADD COLUMN "no_of_invoice" INTEGER,
  ADD COLUMN "party_name" VARCHAR(255),
  ADD COLUMN "invoice_nos" TEXT[],
  ADD COLUMN "bill_nos" TEXT[];