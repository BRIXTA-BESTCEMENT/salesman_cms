ALTER TABLE "daily_visit_reports" ADD COLUMN "customer_type" varchar(100);--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD COLUMN "party_type" varchar(100);--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD COLUMN "name_of_party" varchar(255);--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD COLUMN "contact_no_of_party" varchar(20);--> statement-breakpoint
ALTER TABLE "daily_visit_reports" ADD COLUMN "expected_activation_date" date;