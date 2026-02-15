CREATE UNIQUE INDEX "uniq_collection_voucher_inst" ON "collection_reports"("voucher_no", "institution");
CREATE UNIQUE INDEX "uniq_projection_snapshot" ON "projection_reports"("report_date", "order_dealer_name", "collection_dealer_name", "institution");

ALTER TABLE "projection_vs_actual_reports" 
  ALTER COLUMN "institution" SET NOT NULL;