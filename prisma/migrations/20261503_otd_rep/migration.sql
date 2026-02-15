ALTER TABLE "outstanding_reports" 
  ADD CONSTRAINT "unique_outstanding_entry" 
  UNIQUE ("report_date", "verified_dealer_id", "is_account_jsb_jud");